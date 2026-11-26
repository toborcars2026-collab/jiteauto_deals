import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  Save,
  X,
  Loader2,
  Upload,
  AlertCircle,
  CheckCircle2,
  Star,
  ArrowLeft,
  ArrowRight,
  Trash2,
  RefreshCw,
  Camera,
  CloudUpload,
  Eye,
  Replace,
  Tag,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FileCheck2,
  RotateCcw,
} from 'lucide-react';
import { Vehicle, VehicleImageRecord } from '../../types';
import { recordAdminAuditLog } from '../../services/adminAudit';
import {
  saveVehicleToFirestore,
  uploadVehicleImageToCloudinary,
  getCloudinaryUploadStatus,
  CloudinaryUploadStatus,
  normalizeVehicleData,
  resolveImageLink,
  getImageUrl,
  getOptimizedImageUrl,
  formatCurrency,
} from '../../utils';

interface AdminAddCarTabProps {
  editingCar: Partial<Vehicle> | null;
  onSuccess: (savedCar: Vehicle) => void;
  onCancel: () => void;
}

export interface PhotoCardItem {
  id: string;
  file?: File;
  fileSignature?: string;
  previewUrl: string;
  isExistingUrl?: boolean;
  uploadedUrl?: string;
  publicId?: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  uploadedAt?: string;
  angleTag?: string;
  status: 'waiting' | 'optimizing' | 'signing' | 'uploading' | 'done' | 'error';
  progress: number;
  bytesTransferred?: number;
  totalBytes?: number;
  errorMessage?: string;
  fileName?: string;
  fileSizeText?: string;
  statusNote?: string;
}

const MAX_PHOTOS_PER_VEHICLE = 25;
const MAX_UPLOAD_CONCURRENCY = 3;
const DRAFT_STORAGE_KEY = 'jite_admin_vehicle_draft_v1';

const PHOTO_ANGLE_TAGS = [
  'Auto / Unlabeled',
  'Front Exterior',
  'Side Profile',
  'Rear Exterior',
  'Interior Cabin',
  'Dashboard & Cockpit',
  'Seats & Trim',
  'Engine Bay',
  'Wheels / Tires',
  'Boot / Trunk',
];

const SUGGESTED_KEY_FEATURES = [
  'Sunroof / Panoramic Roof',
  '360° Camera',
  'Leather Interior',
  'Push Start / Keyless',
  'First Body Paint',
  'Apple CarPlay / Android Auto',
  'Blind Spot Assist',
  'Memory Heated Seats',
  'Alloy Wheels',
  'Custom Duty Verified',
];

const DUTY_STATUS_OPTIONS = [
  'Full Customs Duty Paid',
  'Cleared & Verified',
  'Nigerian Registered',
  'Clearing in Progress',
  'Direct Belgium Cleared',
  'Not Applicable',
];

function createDraftVehicleId(make?: string, model?: string, year?: number): string {
  const cleanMake = (make || 'car').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'car';
  const cleanModel = (model || 'unit').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unit';
  const yr = year || 2021;
  return `${yr}-${cleanMake}-${cleanModel}-${Date.now().toString(36)}`;
}

function buildInitialCarData(editingCar: Partial<Vehicle> | null): Partial<Vehicle> {
  return {
    make: '',
    model: '',
    year: 2021,
    price: 15000000,
    transmission: 'Automatic',
    fuelType: 'Petrol',
    bodyType: 'SUV',
    location: 'Lagos',
    dealership: 'Jite Premium Sourcing',
    dutyStatus: 'Full Customs Duty Paid',
    keyFeatures: [],
    images: [],
    imageMetadata: [],
    description: '',
    color: 'Silver',
    condition: 'Foreign Used',
    isFeatured: true,
    inSlideshow: true,
    status: 'Available',
    ...(editingCar || {}),
  };
}

function buildInitialPhotoCards(editingCar: Partial<Vehicle> | null): PhotoCardItem[] {
  if (!editingCar?.images || editingCar.images.length === 0) return [];
  const metaMap = new Map<string, VehicleImageRecord>();
  if (Array.isArray(editingCar.imageMetadata)) {
    editingCar.imageMetadata.forEach((m) => {
      if (m?.secureUrl) metaMap.set(m.secureUrl, m);
    });
  }
  return editingCar.images.filter(Boolean).map((url, idx) => {
    const meta = metaMap.get(url);
    return {
      id: `existing_${idx}_${Date.now()}`,
      previewUrl: url,
      uploadedUrl: url,
      publicId: meta?.publicId,
      width: meta?.width,
      height: meta?.height,
      bytes: meta?.bytes,
      format: meta?.format,
      uploadedAt: meta?.uploadedAt,
      angleTag: meta?.angleTag || '',
      isExistingUrl: true,
      status: 'done',
      progress: 100,
      fileName: meta?.angleTag || `Photo #${idx + 1}`,
    };
  });
}

export default function AdminAddCarTab({ editingCar, onSuccess, onCancel }: AdminAddCarTabProps) {
  // Stable Vehicle ID for this listing (also used for Cloudinary folder path)
  const [draftVehicleId, setDraftVehicleId] = useState<string>(() => {
    if (editingCar?.id) return editingCar.id;
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.draftVehicleId && typeof parsed.draftVehicleId === 'string') {
          return parsed.draftVehicleId;
        }
      }
    } catch {}
    return createDraftVehicleId(editingCar?.make, editingCar?.model, editingCar?.year);
  });

  const [restoredFromDraft, setRestoredFromDraft] = useState<boolean>(false);

  const [carData, setCarData] = useState<Partial<Vehicle>>(() => {
    if (!editingCar?.id) {
      try {
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.carData && typeof parsed.carData === 'object') {
            return { ...buildInitialCarData(null), ...parsed.carData };
          }
        }
      } catch {}
    }
    return buildInitialCarData(editingCar);
  });

  const [photoCards, setPhotoCards] = useState<PhotoCardItem[]>(() => {
    if (!editingCar?.id) {
      try {
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed?.uploadedPhotos) && parsed.uploadedPhotos.length > 0) {
            return parsed.uploadedPhotos.map((p: any, idx: number) => ({
              id: p.id || `draft_${idx}_${Date.now()}`,
              previewUrl: p.uploadedUrl,
              uploadedUrl: p.uploadedUrl,
              publicId: p.publicId,
              width: p.width,
              height: p.height,
              bytes: p.bytes,
              format: p.format,
              uploadedAt: p.uploadedAt,
              angleTag: p.angleTag || '',
              isExistingUrl: Boolean(p.isExistingUrl),
              status: 'done',
              progress: 100,
              fileName: p.fileName || `Photo #${idx + 1}`,
              fileSizeText: p.fileSizeText,
            }));
          }
        }
      } catch {}
    }
    return buildInitialPhotoCards(editingCar);
  });

  // Check if draft was restored
  useEffect(() => {
    if (!editingCar?.id) {
      try {
        const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.carData?.make || parsed?.uploadedPhotos?.length > 0) {
            setRestoredFromDraft(true);
          }
        }
      } catch {}
    }
  }, [editingCar?.id]);

  // Cloudinary setup status
  const [cloudinaryStatus, setCloudinaryStatus] = useState<CloudinaryUploadStatus | null>(null);
  const [isCheckingCloudinary, setIsCheckingCloudinary] = useState(true);

  const checkCloudinaryConnection = useCallback(async () => {
    setIsCheckingCloudinary(true);
    try {
      const st = await getCloudinaryUploadStatus();
      setCloudinaryStatus(st);
    } catch {
      setCloudinaryStatus(null);
    } finally {
      setIsCheckingCloudinary(false);
    }
  }, []);

  useEffect(() => {
    checkCloudinaryConnection();
  }, [checkCloudinaryConnection]);

  // Inputs & Drag-and-Drop Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetIdRef = useRef<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Active abort functions & upload queue management
  const abortControllersRef = useRef<Map<string, () => void>>(new Map());
  const activeUploadIdsRef = useRef<Set<string>>(new Set());
  const queuedIdsRef = useRef<string[]>([]);
  const photoCardsRef = useRef<PhotoCardItem[]>(photoCards);
  photoCardsRef.current = photoCards;
  const draftVehicleIdRef = useRef<string>(draftVehicleId);
  draftVehicleIdRef.current = draftVehicleId;

  // Lightbox Preview inside Editor
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Key Features Tag input
  const [featureInput, setFeatureInput] = useState('');

  // Manual URL fallback accordion
  const [showUrlPasteBox, setShowUrlPasteBox] = useState(false);
  const [manualUrlInput, setManualUrlInput] = useState('');

  // Form & Publishing states
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatusText, setPublishStatusText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);
  const [publishedVehicle, setPublishedVehicle] = useState<Vehicle | null>(null);

  // Synchronize when editingCar changes
  useEffect(() => {
    if (editingCar) {
      setDraftVehicleId(editingCar.id || createDraftVehicleId(editingCar.make, editingCar.model, editingCar.year));
      setCarData(buildInitialCarData(editingCar));
      setPhotoCards(buildInitialPhotoCards(editingCar));
      setRestoredFromDraft(false);
    }
  }, [editingCar]);

  // Auto-save Draft for New Vehicle listings (never wipes uploaded Cloudinary photos on refresh/disconnect)
  useEffect(() => {
    if (editingCar?.id || publishedVehicle) return;
    const uploadedPhotos = photoCards
      .filter((p) => p.status === 'done' && p.uploadedUrl)
      .map((p) => ({
        id: p.id,
        uploadedUrl: p.uploadedUrl,
        publicId: p.publicId,
        width: p.width,
        height: p.height,
        bytes: p.bytes,
        format: p.format,
        uploadedAt: p.uploadedAt,
        angleTag: p.angleTag,
        isExistingUrl: p.isExistingUrl,
        fileName: p.fileName,
        fileSizeText: p.fileSizeText,
      }));

    const hasContent =
      Boolean(carData.make?.trim()) ||
      Boolean(carData.model?.trim()) ||
      Boolean(carData.description?.trim()) ||
      uploadedPhotos.length > 0;

    if (!hasContent) return;

    try {
      const payload = {
        draftVehicleId,
        carData: {
          ...carData,
          images: undefined,
          imageMetadata: undefined,
        },
        uploadedPhotos,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [carData, photoCards, draftVehicleId, editingCar?.id, publishedVehicle]);

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Controlled Parallel Background Upload Worker (Max 3 simultaneous uploads)
  const processUploadQueue = useCallback(() => {
    while (
      activeUploadIdsRef.current.size < MAX_UPLOAD_CONCURRENCY &&
      queuedIdsRef.current.length > 0
    ) {
      const nextId = queuedIdsRef.current.shift()!;
      const card = photoCardsRef.current.find((p) => p.id === nextId);
      if (!card || !card.file || card.uploadedUrl || activeUploadIdsRef.current.has(nextId)) {
        continue;
      }

      activeUploadIdsRef.current.add(nextId);
      const slotIndex = Math.max(0, photoCardsRef.current.findIndex((p) => p.id === nextId));

      setPhotoCards((prev) =>
        prev.map((p) =>
          p.id === nextId
            ? { ...p, status: 'optimizing', progress: 4, errorMessage: undefined }
            : p
        )
      );

      uploadVehicleImageToCloudinary({
        file: card.file,
        vehicleId: draftVehicleIdRef.current,
        slotIndex,
        onRegisterAbort: (abortFn) => {
          abortControllersRef.current.set(nextId, abortFn);
        },
        onProgress: (percent, transferred, total, statusNote, stage) => {
          setPhotoCards((prev) =>
            prev.map((p) =>
              p.id === nextId
                ? {
                    ...p,
                    status: stage || 'uploading',
                    progress: percent,
                    bytesTransferred: transferred,
                    totalBytes: total,
                    statusNote: statusNote || p.statusNote,
                  }
                : p
            )
          );
        },
      })
        .then((result) => {
          abortControllersRef.current.delete(nextId);
          activeUploadIdsRef.current.delete(nextId);

          setPhotoCards((prev) =>
            prev.map((p) =>
              p.id === nextId
                ? {
                    ...p,
                    status: 'done',
                    progress: 100,
                    uploadedUrl: result.secureUrl,
                    publicId: result.publicId,
                    width: result.width,
                    height: result.height,
                    bytes: result.bytes,
                    format: result.format,
                    uploadedAt: result.uploadedAt,
                    statusNote: result.statusNote,
                    errorMessage: undefined,
                  }
                : p
            )
          );
          processUploadQueue();
        })
        .catch((err: any) => {
          abortControllersRef.current.delete(nextId);
          activeUploadIdsRef.current.delete(nextId);

          const msg = err?.message || 'Upload failed';
          const wasCancelled = msg.toLowerCase().includes('cancelled');

          setPhotoCards((prev) =>
            prev.map((p) =>
              p.id === nextId
                ? {
                    ...p,
                    status: 'error',
                    progress: 0,
                    errorMessage: wasCancelled ? 'Cancelled by admin' : msg,
                  }
                : p
            )
          );
          processUploadQueue();
        });
    }
  }, []);

  // Validate and Enqueue Newly Selected/Dropped Files Immediately
  const ingestFiles = useCallback(
    (files: FileList | File[]) => {
      const fileList = Array.from(files);
      if (fileList.length === 0) return;

      setErrorMsg(null);
      setNoticeMsg(null);

      const existingCount = photoCardsRef.current.length;
      const availableSlots = MAX_PHOTOS_PER_VEHICLE - existingCount;
      if (availableSlots <= 0) {
        setErrorMsg(`Maximum ${MAX_PHOTOS_PER_VEHICLE} photos per vehicle reached. Remove an existing photo before adding more.`);
        return;
      }

      const existingSignatures = new Set(
        photoCardsRef.current.map((p) => p.fileSignature).filter(Boolean)
      );

      const skippedMessages: string[] = [];
      const newItems: PhotoCardItem[] = [];

      for (const file of fileList) {
        if (newItems.length >= availableSlots) {
          skippedMessages.push(`Limit of ${MAX_PHOTOS_PER_VEHICLE} photos per vehicle reached.`);
          break;
        }

        const isImageMime = file.type ? file.type.startsWith('image/') : false;
        const isImageExt = /\.(jpe?g|png|webp|avif|heic|heif|jfif|pjpeg)$/i.test(file.name);
        if (!isImageMime && !isImageExt) {
          skippedMessages.push(`"${file.name}" is not a supported image (JPG, PNG, WebP, AVIF, HEIC).`);
          continue;
        }

        if (file.size > 25 * 1024 * 1024) {
          skippedMessages.push(`"${file.name}" exceeds 25MB limit.`);
          continue;
        }

        const sig = `${file.name}::${file.size}::${file.lastModified}`;
        if (existingSignatures.has(sig)) {
          skippedMessages.push(`"${file.name}" was skipped (duplicate image).`);
          continue;
        }
        existingSignatures.add(sig);

        let objectUrl = '';
        try {
          objectUrl = URL.createObjectURL(file);
        } catch {
          objectUrl = '';
        }

        const id = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        newItems.push({
          id,
          file,
          fileSignature: sig,
          previewUrl: objectUrl,
          isExistingUrl: false,
          status: 'waiting',
          progress: 0,
          fileName: file.name,
          fileSizeText: formatFileSize(file.size),
        });
      }

      if (skippedMessages.length > 0) {
        setNoticeMsg(skippedMessages.slice(0, 3).join(' '));
      }

      if (newItems.length > 0) {
        setPhotoCards((prev) => [...prev, ...newItems]);
        newItems.forEach((item) => {
          queuedIdsRef.current.push(item.id);
        });
        setTimeout(() => processUploadQueue(), 20);
      }
    },
    [processUploadQueue]
  );

  // Native File Input Triggers
  const handleTriggerGalleryUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleTriggerCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
      cameraInputRef.current.click();
    }
  };

  const handleTriggerReplace = (cardId: string) => {
    replaceTargetIdRef.current = cardId;
    if (replaceInputRef.current) {
      replaceInputRef.current.value = '';
      replaceInputRef.current.click();
    }
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      ingestFiles(e.target.files);
    }
  };

  const handleReplaceFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetId = replaceTargetIdRef.current;
    const file = e.target.files?.[0];
    replaceTargetIdRef.current = null;
    if (!targetId || !file) return;

    const isImageMime = file.type ? file.type.startsWith('image/') : false;
    const isImageExt = /\.(jpe?g|png|webp|avif|heic|heif|jfif|pjpeg)$/i.test(file.name);
    if (!isImageMime && !isImageExt) {
      setErrorMsg(`"${file.name}" is not a supported image format.`);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg(`"${file.name}" exceeds 25MB limit.`);
      return;
    }

    // Cancel any active upload on target card
    const existingAbort = abortControllersRef.current.get(targetId);
    if (existingAbort) {
      existingAbort();
      abortControllersRef.current.delete(targetId);
    }
    activeUploadIdsRef.current.delete(targetId);
    queuedIdsRef.current = queuedIdsRef.current.filter((qid) => qid !== targetId);

    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {}

    setPhotoCards((prev) =>
      prev.map((p) =>
        p.id === targetId
          ? {
              ...p,
              file,
              fileSignature: `${file.name}::${file.size}::${file.lastModified}`,
              previewUrl: objectUrl || p.previewUrl,
              isExistingUrl: false,
              uploadedUrl: undefined,
              publicId: undefined,
              width: undefined,
              height: undefined,
              bytes: undefined,
              format: undefined,
              uploadedAt: undefined,
              status: 'waiting',
              progress: 0,
              errorMessage: undefined,
              fileName: file.name,
              fileSizeText: formatFileSize(file.size),
            }
          : p
      )
    );

    queuedIdsRef.current.unshift(targetId);
    setTimeout(() => processUploadQueue(), 20);
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      ingestFiles(e.dataTransfer.files);
    }
  };

  // Cancel Single In-Flight Upload
  const handleCancelUpload = (id: string) => {
    queuedIdsRef.current = queuedIdsRef.current.filter((qid) => qid !== id);
    const abortFn = abortControllersRef.current.get(id);
    if (abortFn) {
      abortFn();
    } else {
      setPhotoCards((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: 'error', progress: 0, errorMessage: 'Cancelled by admin' } : p
        )
      );
    }
  };

  // Retry Single Photo Upload
  const handleRetrySinglePhoto = (id: string) => {
    const item = photoCardsRef.current.find((p) => p.id === id);
    if (!item || !item.file || item.uploadedUrl) return;
    setErrorMsg(null);
    setPhotoCards((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: 'waiting', progress: 0, errorMessage: undefined } : p
      )
    );
    if (!queuedIdsRef.current.includes(id)) {
      queuedIdsRef.current.unshift(id);
    }
    setTimeout(() => processUploadQueue(), 20);
  };

  // Card Reorder & Management
  const handleSetPrimary = (index: number) => {
    if (index === 0 || index >= photoCards.length) return;
    setPhotoCards((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.unshift(item);
      return copy;
    });
  };

  const handleMoveLeft = (index: number) => {
    if (index <= 0) return;
    setPhotoCards((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleMoveRight = (index: number) => {
    if (index >= photoCards.length - 1) return;
    setPhotoCards((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  };

  const handleUpdateAngleTag = (id: string, angleTag: string) => {
    setPhotoCards((prev) =>
      prev.map((p) => (p.id === id ? { ...p, angleTag: angleTag === 'Auto / Unlabeled' ? '' : angleTag } : p))
    );
  };

  const handleRemovePhoto = (id: string) => {
    queuedIdsRef.current = queuedIdsRef.current.filter((qid) => qid !== id);
    const abortFn = abortControllersRef.current.get(id);
    if (abortFn) {
      abortFn();
      abortControllersRef.current.delete(id);
    }
    activeUploadIdsRef.current.delete(id);
    setPhotoCards((prev) => prev.filter((p) => p.id !== id));
    if (lightboxIndex !== null) {
      setLightboxIndex(null);
    }
  };

  // Manual URL compatibility helper
  const handleAddManualUrl = async () => {
    const raw = manualUrlInput.trim();
    if (!raw) return;

    if (photoCards.length >= MAX_PHOTOS_PER_VEHICLE) {
      setErrorMsg(`Maximum ${MAX_PHOTOS_PER_VEHICLE} photos per vehicle reached.`);
      return;
    }

    try {
      const resolved = await resolveImageLink(raw);
      setPhotoCards((prev) => [
        ...prev,
        {
          id: `url_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          previewUrl: resolved,
          uploadedUrl: resolved,
          isExistingUrl: true,
          status: 'done',
          progress: 100,
          fileName: 'Linked Image URL',
        },
      ]);
      setManualUrlInput('');
      setShowUrlPasteBox(false);
    } catch {
      setErrorMsg('Failed to resolve external image URL.');
    }
  };

  // Key Features Helpers
  const currentFeatures = Array.isArray(carData.keyFeatures) ? carData.keyFeatures : [];

  const handleAddFeature = (rawFeature: string) => {
    const trimmed = rawFeature.trim();
    if (!trimmed) return;
    if (currentFeatures.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
      setFeatureInput('');
      return;
    }
    if (currentFeatures.length >= 25) return;
    setCarData((prev) => ({
      ...prev,
      keyFeatures: [...(Array.isArray(prev.keyFeatures) ? prev.keyFeatures : []), trimmed],
    }));
    setFeatureInput('');
  };

  const handleRemoveFeature = (feature: string) => {
    setCarData((prev) => ({
      ...prev,
      keyFeatures: (Array.isArray(prev.keyFeatures) ? prev.keyFeatures : []).filter((f) => f !== feature),
    }));
  };

  // Clear local draft
  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
    abortControllersRef.current.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
    abortControllersRef.current.clear();
    activeUploadIdsRef.current.clear();
    queuedIdsRef.current = [];
    setDraftVehicleId(createDraftVehicleId());
    setCarData(buildInitialCarData(null));
    setPhotoCards([]);
    setRestoredFromDraft(false);
    setErrorMsg(null);
    setNoticeMsg(null);
  };

  const handleResetForNew = () => {
    setPublishedVehicle(null);
    handleDiscardDraft();
  };

  // Derived Upload Status Counters
  const completedCount = photoCards.filter((p) => p.status === 'done' && Boolean(p.uploadedUrl)).length;
  const activeCount = photoCards.filter((p) =>
    ['waiting', 'optimizing', 'signing', 'uploading'].includes(p.status)
  ).length;
  const failedCount = photoCards.filter((p) => p.status === 'error').length;
  const overallProgress =
    photoCards.length === 0
      ? 0
      : Math.round(
          photoCards.reduce((acc, c) => acc + (c.status === 'done' ? 100 : c.progress || 0), 0) /
            photoCards.length
        );

  // Publish Workflow
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishing) return;
    setErrorMsg(null);

    const make = (carData.make || '').trim();
    const model = (carData.model || '').trim();
    const year = Number(carData.year) || 2021;
    const price = Number(carData.price) || 0;

    if (!make || !model) {
      setErrorMsg('Please specify both the Vehicle Brand/Make and Model Name in Step 2.');
      return;
    }

    if (price <= 0) {
      setErrorMsg('Please enter a valid asking price in Nigerian Naira (₦).');
      return;
    }

    if (photoCards.length === 0) {
      setErrorMsg('Please upload at least one vehicle photograph in Step 1 before publishing.');
      return;
    }

    if (failedCount > 0) {
      setErrorMsg(
        `${failedCount} photograph${failedCount > 1 ? 's' : ''} failed to upload. Please click "Retry Photo" or remove failed items before publishing.`
      );
      return;
    }

    if (activeCount > 0) {
      setErrorMsg(
        `Please wait for the remaining ${activeCount} photograph${activeCount > 1 ? 's' : ''} to finish uploading to Cloudinary.`
      );
      return;
    }

    const finalImageUrls: string[] = [];
    const finalImageMetadata: VehicleImageRecord[] = [];
    const targetId = carData.id || draftVehicleId;

    photoCards.forEach((card, idx) => {
      const url = card.uploadedUrl || (card.isExistingUrl ? card.previewUrl : '');
      if (!url) return;
      finalImageUrls.push(url);
      finalImageMetadata.push({
        vehicleId: targetId,
        publicId: card.publicId || `external_${idx + 1}`,
        secureUrl: url,
        position: idx + 1,
        isCover: idx === 0,
        uploadedAt: card.uploadedAt || new Date().toISOString(),
        ...(typeof card.width === 'number' ? { width: card.width } : {}),
        ...(typeof card.height === 'number' ? { height: card.height } : {}),
        ...(typeof card.bytes === 'number' ? { bytes: card.bytes } : {}),
        ...(card.format ? { format: card.format } : {}),
        ...(card.angleTag ? { angleTag: card.angleTag } : {}),
      });
    });

    if (finalImageUrls.length === 0) {
      setErrorMsg('No completed image URLs available to publish. Please upload at least one photograph.');
      return;
    }

    setIsPublishing(true);
    setPublishStatusText('Saving vehicle record & Cloudinary metadata to Cloud Firestore...');

    try {
      const payload: Vehicle = normalizeVehicleData({
        id: targetId,
        make,
        model,
        year,
        price,
        transmission: (carData.transmission as any) || 'Automatic',
        fuelType: carData.fuelType || 'Petrol',
        bodyType: carData.bodyType || 'SUV',
        location: (carData.location || 'Lagos').trim(),
        dealership: carData.dealership || 'Jite Premium Sourcing',
        dutyStatus: (carData.dutyStatus || '').trim() || undefined,
        keyFeatures: currentFeatures.length > 0 ? currentFeatures : undefined,
        images: finalImageUrls,
        imageMetadata: finalImageMetadata,
        description: (carData.description || '').trim() || 'Verified clean condition with physical inspection.',
        engine: (carData.engine || '').trim(),
        mileage: Number(carData.mileage) || 0,
        color: (carData.color || 'Silver').trim(),
        condition: (carData.condition as any) || 'Foreign Used',
        isFeatured: carData.isFeatured ?? true,
        inSlideshow: carData.inSlideshow ?? true,
        status: (carData.status as any) || 'Available',
        createdAt: carData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const confirmed = await saveVehicleToFirestore(payload);

      await recordAdminAuditLog({
        action: editingCar?.id ? 'VEHICLE_UPDATED' : 'VEHICLE_PUBLISHED',
        status: 'success',
        details: `${editingCar?.id ? 'Updated' : 'Published'} ${confirmed.year} ${confirmed.make} ${confirmed.model} (${confirmed.images?.length || 0} photos).`,
      });

      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}

      setPublishedVehicle(confirmed);
      onSuccess(confirmed);
    } catch (err: any) {
      console.error('[Publish Error]:', err);
      setErrorMsg(
        err?.message?.includes('permission') || err?.message?.includes('PERMISSION_DENIED')
          ? 'Cloud Firestore permission error. Please ensure you are signed in with an active administrator account.'
          : err?.message || 'Failed to publish vehicle. Your uploaded Cloudinary photos are safely preserved; please retry.'
      );
    } finally {
      setIsPublishing(false);
      setPublishStatusText('');
    }
  };

  // STEP 4 CONFIRMATION SCREEN
  if (publishedVehicle) {
    return (
      <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-10 border border-emerald-500/30 shadow-2xl space-y-6 text-center animate-fadeIn">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
          <CheckCircle2 size={34} className="stroke-[2.5]" />
        </div>

        <div className="space-y-2">
          <span className="text-[11px] uppercase tracking-widest text-emerald-400 font-mono font-bold block">
            LIVE INVENTORY UPDATED
          </span>
          <h2 className="text-2xl sm:text-3xl font-black font-display text-white">
            Vehicle published successfully!
          </h2>
          <p className="text-slate-300 text-sm max-w-lg mx-auto">
            Vehicle published successfully! Your vehicle is now available on Jite Auto Deals.
          </p>
        </div>

        <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 text-left">
          {publishedVehicle.images?.[0] && (
            <img
              src={getOptimizedImageUrl(publishedVehicle.images[0], 'thumb')}
              alt={publishedVehicle.model}
              className="w-24 h-18 rounded-xl object-cover border border-slate-700 shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-white text-sm truncate">
              {publishedVehicle.year} {publishedVehicle.make} {publishedVehicle.model}
            </h3>
            <p className="text-amber-400 font-mono font-bold text-sm mt-0.5">
              {formatCurrency(publishedVehicle.price)}
            </p>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {publishedVehicle.images?.length || 0} Photos · {publishedVehicle.condition || 'Foreign Used'}
              {publishedVehicle.dutyStatus ? ` · ${publishedVehicle.dutyStatus}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleResetForNew}
            className="w-full sm:w-auto px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            <span>Publish Another Vehicle</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer border border-slate-700 active:scale-95 flex items-center justify-center gap-2"
          >
            <span>Back to Inventory</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Step Progress Strip */}
      <div className="border-b border-slate-200 pb-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950 font-display flex items-center gap-2">
              <CloudUpload size={22} className="text-amber-500 shrink-0" />
              <span>
                {editingCar?.id
                  ? `Edit Listing: ${editingCar.year} ${editingCar.make} ${editingCar.model}`
                  : 'Add & Publish New Vehicle'}
              </span>
            </h2>
            <p className="text-slate-500 text-xs mt-1">
              Upload photos directly from your phone or computer to Cloudinary, enter vehicle specifications, and publish live.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!editingCar?.id && restoredFromDraft && (
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="text-xs font-semibold text-slate-600 hover:text-rose-700 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-rose-200 bg-slate-50 flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Clear Draft</span>
              </button>
            )}
            {editingCar?.id && (
              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-slate-600 hover:text-slate-950 font-bold px-3.5 py-2 rounded-xl border border-slate-200 bg-white cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </div>

        {/* 4-Step Progress Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div
            className={`px-3 py-2 rounded-xl border text-xs flex items-center gap-2 ${
              completedCount > 0 && failedCount === 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-slate-950 text-white border-slate-800'
            }`}
          >
            <span className="font-mono font-black text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-slate-950">
              1
            </span>
            <span className="font-bold truncate">Photos ({completedCount}/{photoCards.length})</span>
          </div>
          <div
            className={`px-3 py-2 rounded-xl border text-xs flex items-center gap-2 ${
              carData.make && carData.model && (carData.price || 0) > 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <span className="font-mono font-black text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
              2
            </span>
            <span className="font-bold truncate">Vehicle Details</span>
          </div>
          <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs flex items-center gap-2">
            <span className="font-mono font-black text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
              3
            </span>
            <span className="font-bold truncate">Review Summary</span>
          </div>
          <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-xs flex items-center gap-2">
            <span className="font-mono font-black text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
              4
            </span>
            <span className="font-bold truncate">Publish Live</span>
          </div>
        </div>
      </div>

      {/* Draft Restored Banner */}
      {!editingCar?.id && restoredFromDraft && (
        <div className="p-3.5 rounded-2xl bg-slate-900 text-slate-100 border border-amber-500/30 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileCheck2 size={16} className="text-amber-400 shrink-0" />
            <span>
              Saved draft restored ({completedCount} uploaded photo{completedCount === 1 ? '' : 's'} preserved). Continue editing or clear draft to start fresh.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRestoredFromDraft(false)}
            className="text-slate-400 hover:text-white font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Cloudinary Configuration Status Banner */}
      {!isCheckingCloudinary && cloudinaryStatus && !cloudinaryStatus.configured && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert size={18} className="text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-slate-950">
                  Cloudinary Direct Upload Needs Environment Keys
                </p>
                <p className="text-amber-900 leading-relaxed">
                  Add <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">{cloudinaryStatus.missing.join(', ')}</code> in your Vercel Project Environment Variables (or local environment) to enable direct photo uploads from your phone and computer.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={checkCloudinaryConnection}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-amber-400 font-bold text-[11px] shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>Re-check</span>
            </button>
          </div>
        </div>
      )}

      {/* Alerts */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-start gap-2.5">
          <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-0.5">
            <span className="font-bold block text-rose-950">Action Required:</span>
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-800 cursor-pointer text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {noticeMsg && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-start justify-between gap-2">
          <span>{noticeMsg}</span>
          <button
            type="button"
            onClick={() => setNoticeMsg(null)}
            className="text-amber-700 hover:text-amber-950 font-bold cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* =================================================================== */}
        {/* STEP 1: PROFESSIONAL CLOUDINARY VEHICLE PHOTO UPLOAD MANAGER        */}
        {/* =================================================================== */}
        <section className="rounded-3xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* Navy Header Strip */}
          <div className="bg-slate-950 text-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-black uppercase tracking-widest bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md">
                  STEP 1
                </span>
                <h3 className="text-sm sm:text-base font-bold font-display">
                  Upload Vehicle Photographs
                </h3>
                {cloudinaryStatus?.configured && (
                  <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-950/90 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                    Cloudinary Ready
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                Photos upload immediately to Cloudinary in the background while you fill out vehicle details. Spot #1 is your Cover Photo.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleTriggerGalleryUpload}
                disabled={isPublishing || photoCards.length >= MAX_PHOTOS_PER_VEHICLE}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-black rounded-xl shadow text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <Upload size={15} />
                <span>Select Images From Device</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerCameraCapture}
                disabled={isPublishing || photoCards.length >= MAX_PHOTOS_PER_VEHICLE}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white border border-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
                title="Open phone camera directly"
              >
                <Camera size={15} className="text-amber-400" />
                <span>Take Photo</span>
              </button>
            </div>
          </div>

          {/* Hidden Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,image/jpeg,image/jpg,image/png,image/webp,image/avif,image/heic,image/heif"
            className="hidden"
            onChange={handleFilesSelected}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFilesSelected}
          />
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/*,image/jpeg,image/jpg,image/png,image/webp,image/avif,image/heic,image/heif"
            className="hidden"
            onChange={handleReplaceFileSelected}
          />

          <div className="p-5 space-y-5">
            {/* Drag & Drop Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={photoCards.length === 0 ? handleTriggerGalleryUpload : undefined}
              className={`rounded-2xl border-2 border-dashed transition-all p-6 text-center ${
                isDragActive
                  ? 'border-amber-500 bg-amber-50/70 scale-[1.01]'
                  : 'border-slate-300 bg-slate-50/70 hover:border-amber-400'
              } ${photoCards.length === 0 ? 'cursor-pointer py-10' : 'py-5'}`}
            >
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
                  <CloudUpload size={24} />
                </div>
                <div className="text-center sm:text-left">
                  <p className="text-sm font-bold text-slate-900">
                    {isDragActive
                      ? 'Drop vehicle photographs here to upload immediately'
                      : photoCards.length === 0
                      ? 'Drag & drop photos here, or tap Select Images From Device'
                      : `Drag & drop additional photos (${photoCards.length}/${MAX_PHOTOS_PER_VEHICLE} selected)`}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Supports 15–25 photos per listing (JPG, PNG, WebP, AVIF, HEIC · max 15MB after optimization). Folder:{' '}
                    <code className="font-mono text-[10px] text-slate-700 bg-slate-200/70 px-1.5 py-0.5 rounded">
                      Jite-Auto-Deals/Vehicles/{draftVehicleId}/Vehicle-Images
                    </code>
                  </p>
                </div>
              </div>
            </div>

            {/* Live Upload Progress Bar (appears whenever active or failed items exist, or summary bar) */}
            {photoCards.length > 0 && (
              <div className="rounded-2xl bg-slate-950 text-white p-4 border border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 font-mono font-bold">
                    {activeCount > 0 ? (
                      <>
                        <Loader2 size={15} className="animate-spin text-amber-400" />
                        <span className="text-amber-300">
                          Uploading {activeCount} in parallel ({completedCount} of {photoCards.length} ready)
                        </span>
                      </>
                    ) : failedCount > 0 ? (
                      <>
                        <AlertCircle size={15} className="text-rose-400" />
                        <span className="text-rose-300">
                          {failedCount} upload{failedCount > 1 ? 's' : ''} need attention · {completedCount} uploaded
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} className="text-emerald-400" />
                        <span className="text-emerald-300">
                          All {completedCount} photograph{completedCount === 1 ? '' : 's'} ready for publishing
                        </span>
                      </>
                    )}
                  </div>
                  <span className="font-mono font-bold text-slate-300 tabular-nums">
                    {overallProgress}% Overall
                  </span>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      failedCount > 0 && activeCount === 0
                        ? 'bg-rose-500'
                        : completedCount === photoCards.length
                        ? 'bg-emerald-500'
                        : 'bg-amber-400'
                    }`}
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Uploaded & Queued Photo Cards Grid */}
            {photoCards.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {photoCards.map((item, index) => {
                  const isPrimary = index === 0;
                  const isUploading = ['waiting', 'optimizing', 'signing', 'uploading'].includes(item.status);
                  const displaySrc = item.uploadedUrl
                    ? getOptimizedImageUrl(item.uploadedUrl, 'thumb')
                    : getImageUrl(item.previewUrl);

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl overflow-hidden border bg-white flex flex-col transition-all ${
                        isPrimary
                          ? 'border-amber-400 ring-2 ring-amber-400/30 shadow-md'
                          : item.status === 'error'
                          ? 'border-rose-300 shadow-xs'
                          : 'border-slate-200 shadow-xs'
                      }`}
                    >
                      {/* Thumbnail Stage */}
                      <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden group">
                        <img
                          src={displaySrc}
                          alt={`Vehicle photo #${index + 1}`}
                          onClick={() => !isUploading && setLightboxIndex(index)}
                          className={`w-full h-full object-cover ${!isUploading ? 'cursor-pointer' : ''}`}
                        />

                        {/* Cover / Index Badge */}
                        <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                          {isPrimary ? (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] uppercase font-mono shadow flex items-center gap-1">
                              <Star size={11} className="fill-slate-950" />
                              <span>COVER #1</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg bg-slate-950/85 text-white font-bold text-[10px] font-mono shadow">
                              #{index + 1}
                            </span>
                          )}
                        </div>

                        {/* Top-Right Quick Actions: Preview & Delete */}
                        <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
                          {!isUploading && (
                            <button
                              type="button"
                              onClick={() => setLightboxIndex(index)}
                              className="w-7 h-7 rounded-lg bg-slate-950/80 hover:bg-slate-950 text-white flex items-center justify-center shadow cursor-pointer"
                              title="View full size"
                            >
                              <Eye size={13} />
                            </button>
                          )}
                          {isUploading ? (
                            <button
                              type="button"
                              onClick={() => handleCancelUpload(item.id)}
                              className="w-7 h-7 rounded-lg bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow cursor-pointer"
                              title="Cancel upload"
                            >
                              <X size={13} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(item.id)}
                              disabled={isPublishing}
                              className="w-7 h-7 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white flex items-center justify-center shadow cursor-pointer"
                              title="Remove photo"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        {/* Uploading Overlay */}
                        {isUploading && (
                          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center p-3 text-white space-y-2 z-10">
                            <Loader2 size={20} className="animate-spin text-amber-400" />
                            <span className="text-[11px] font-mono font-bold text-amber-300 text-center">
                              {item.status === 'waiting'
                                ? 'Queued...'
                                : item.status === 'optimizing'
                                ? 'Optimizing...'
                                : item.status === 'signing'
                                ? 'Authorizing...'
                                : `Uploading ${item.progress}%`}
                            </span>
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-amber-400 h-full transition-all duration-200"
                                style={{ width: `${Math.max(8, item.progress)}%` }}
                              />
                            </div>
                            {item.bytesTransferred && item.totalBytes ? (
                              <span className="text-[9px] font-mono text-slate-300">
                                {formatFileSize(item.bytesTransferred)} / {formatFileSize(item.totalBytes)}
                              </span>
                            ) : null}
                          </div>
                        )}

                        {/* Done Badge */}
                        {item.status === 'done' && item.uploadedUrl && (
                          <div className="absolute bottom-2 right-2 bg-emerald-600/95 text-white text-[10px] font-mono px-2 py-0.5 rounded-md font-bold flex items-center gap-1 shadow">
                            <CheckCircle2 size={11} />
                            <span>{item.publicId ? 'Cloudinary' : 'Ready'}</span>
                          </div>
                        )}

                        {/* Error Overlay */}
                        {item.status === 'error' && (
                          <div className="absolute inset-0 bg-rose-950/92 flex flex-col items-center justify-center p-3 text-rose-100 text-center text-[10px] font-mono z-10 space-y-2">
                            <AlertCircle size={18} className="text-rose-400 shrink-0" />
                            <span className="line-clamp-3 font-semibold leading-snug">
                              {item.errorMessage || 'Upload failed'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRetrySinglePhoto(item.id)}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1 shadow"
                            >
                              <RefreshCw size={11} />
                              <span>Retry Photo</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Card Metadata, Angle Label & Controls */}
                      <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex flex-col gap-2 flex-1 justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1 text-[11px] font-mono">
                            <span className="font-bold text-slate-800 truncate">
                              {item.fileName || `Photo #${index + 1}`}
                            </span>
                            <span className="text-slate-400 text-[10px] shrink-0">
                              {item.bytes ? formatFileSize(item.bytes) : item.fileSizeText || ''}
                            </span>
                          </div>

                          {/* Optional View Tag */}
                          <select
                            value={item.angleTag || 'Auto / Unlabeled'}
                            disabled={isUploading || isPublishing}
                            onChange={(e) => handleUpdateAngleTag(item.id, e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-700 focus:outline-none focus:border-amber-500"
                            aria-label={`Photo angle tag for photo ${index + 1}`}
                          >
                            {PHOTO_ANGLE_TAGS.map((tag) => (
                              <option key={tag} value={tag}>
                                {tag}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Reorder / Cover / Replace Controls */}
                        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-200/70">
                          <button
                            type="button"
                            onClick={() => handleMoveLeft(index)}
                            disabled={index === 0 || isPublishing}
                            className="p-1 rounded-md text-slate-600 hover:text-slate-950 hover:bg-slate-200 disabled:opacity-25 cursor-pointer"
                            title="Move left"
                          >
                            <ArrowLeft size={13} />
                          </button>

                          {!isPrimary ? (
                            <button
                              type="button"
                              onClick={() => handleSetPrimary(index)}
                              disabled={isPublishing}
                              className="text-[10px] font-bold text-amber-700 hover:text-amber-800 hover:underline px-1 cursor-pointer font-mono"
                            >
                              Make Cover
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 font-mono">
                              Primary Cover
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleTriggerReplace(item.id)}
                            disabled={isPublishing || isUploading}
                            className="p-1 rounded-md text-slate-600 hover:text-slate-950 hover:bg-slate-200 disabled:opacity-25 cursor-pointer"
                            title="Replace photo"
                          >
                            <Replace size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveRight(index)}
                            disabled={index === photoCards.length - 1 || isPublishing}
                            className="p-1 rounded-md text-slate-600 hover:text-slate-950 hover:bg-slate-200 disabled:opacity-25 cursor-pointer"
                            title="Move right"
                          >
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!isPublishing && photoCards.length < MAX_PHOTOS_PER_VEHICLE && (
                  <button
                    type="button"
                    onClick={handleTriggerGalleryUpload}
                    className="aspect-[4/3] rounded-2xl border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50/50 hover:bg-amber-50/30 flex flex-col items-center justify-center p-4 cursor-pointer transition-all space-y-2 text-center"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <Plus size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Add More Photos</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Up to {MAX_PHOTOS_PER_VEHICLE} total
                      </span>
                    </div>
                  </button>
                )}
              </div>
            )}

            {/* Backward Compatibility Accordion */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowUrlPasteBox(!showUrlPasteBox)}
                className="text-xs text-slate-500 hover:text-slate-900 font-mono font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <span>
                  {showUrlPasteBox
                    ? '▼ Hide Manual Image Link Input'
                    : '▶ Advanced: Paste External Image URL (Cloudinary, ImgBB, etc.)'}
                </span>
              </button>

              {showUrlPasteBox && (
                <div className="mt-2 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <label className="text-xs font-bold font-mono text-slate-700 uppercase tracking-wider block">
                    Paste Direct Image URL
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      placeholder="https://res.cloudinary.com/... or https://i.ibb.co/..."
                      value={manualUrlInput}
                      onChange={(e) => setManualUrlInput(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualUrl}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold font-mono cursor-pointer shrink-0"
                    >
                      Add Link
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* STEP 2: VEHICLE SPECIFICATIONS, DUTY STATUS & KEY FEATURES          */}
        {/* =================================================================== */}
        <section className="rounded-3xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="bg-slate-950 text-white px-5 py-4 flex items-center gap-2">
            <span className="text-[10px] font-mono font-black uppercase tracking-widest bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md">
              STEP 2
            </span>
            <h3 className="text-sm sm:text-base font-bold font-display">
              Enter Vehicle Details & Specifications
            </h3>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {/* Make & Model */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-slate-700 font-bold font-mono">
                  Make / Brand *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mercedes-Benz, Toyota, Lexus, Honda"
                  value={carData.make || ''}
                  onChange={(e) => setCarData({ ...carData, make: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-slate-700 font-bold font-mono">
                  Model Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GLE 350, Camry XSE, RX 350, Accord Touring"
                  value={carData.model || ''}
                  onChange={(e) => setCarData({ ...carData, model: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-semibold"
                />
              </div>
            </div>

            {/* Year, Price, Condition, Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-slate-700 font-bold font-mono">
                  Model Year *
                </label>
                <input
                  type="number"
                  required
                  min="1985"
                  max="2035"
                  value={carData.year || ''}
                  onChange={(e) => setCarData({ ...carData, year: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-slate-700 font-bold font-mono">
                  Price (NGN ₦) *
                </label>
                <input
                  type="number"
                  required
                  min="100000"
                  value={carData.price || ''}
                  onChange={(e) => setCarData({ ...carData, price: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500 font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-slate-700 font-bold font-mono">
                  Condition *
                </label>
                <select
                  value={carData.condition || 'Foreign Used'}
                  onChange={(e) => setCarData({ ...carData, condition: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none font-semibold"
                >
                  <option value="Foreign Used">Foreign Used (Tokunbo)</option>
                  <option value="Extremely Clean Used">Extremely Clean Used</option>
                  <option value="Nigerian Used">Nigerian Used</option>
                  <option value="Direct Belgium">Direct Belgium</option>
                  <option value="Brand New">Brand New</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-slate-700 font-bold font-mono">
                  Listing Status *
                </label>
                <select
                  value={carData.status || 'Available'}
                  onChange={(e) => setCarData({ ...carData, status: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none font-bold"
                >
                  <option value="Available">Available</option>
                  <option value="Reserved">Reserved</option>
                  <option value="Sold">Sold</option>
                  <option value="Hidden">Hidden</option>
                </select>
              </div>
            </div>

            {/* Duty Status, Exterior Colour, Location, Body Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-slate-600 font-bold font-mono">
                  Duty Status
                </label>
                <select
                  value={
                    DUTY_STATUS_OPTIONS.includes(carData.dutyStatus || '')
                      ? carData.dutyStatus
                      : 'Full Customs Duty Paid'
                  }
                  onChange={(e) => setCarData({ ...carData, dutyStatus: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-semibold"
                >
                  {DUTY_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-slate-600 font-bold font-mono">
                  Exterior Colour
                </label>
                <input
                  type="text"
                  placeholder="e.g. Obsidian Black, Pearl White"
                  value={carData.color || ''}
                  onChange={(e) => setCarData({ ...carData, color: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-slate-600 font-bold font-mono">
                  Location *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lagos, Abuja, Port Harcourt"
                  value={carData.location || ''}
                  onChange={(e) => setCarData({ ...carData, location: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-slate-600 font-bold font-mono">
                  Body Type
                </label>
                <select
                  value={carData.bodyType || 'SUV'}
                  onChange={(e) => setCarData({ ...carData, bodyType: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none"
                >
                  <option value="SUV">SUV</option>
                  <option value="Sedan">Sedan</option>
                  <option value="Coupe">Coupe</option>
                  <option value="Truck">Truck</option>
                  <option value="Hatchback">Hatchback</option>
                  <option value="Crossover">Crossover</option>
                  <option value="Minivan">Minivan</option>
                  <option value="Luxury SUV">Luxury SUV</option>
                </select>
              </div>
            </div>

            {/* Transmission, Fuel, Engine, Mileage */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">
                  Transmission
                </label>
                <select
                  value={carData.transmission || 'Automatic'}
                  onChange={(e) => setCarData({ ...carData, transmission: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none"
                >
                  <option value="Automatic">Automatic</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">
                  Fuel Type
                </label>
                <select
                  value={carData.fuelType || 'Petrol'}
                  onChange={(e) => setCarData({ ...carData, fuelType: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none"
                >
                  <option value="Petrol">Petrol</option>
                  <option value="Diesel">Diesel</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Electric">Electric</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">
                  Engine
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3.5L V6, 2.0L Turbo"
                  value={carData.engine || ''}
                  onChange={(e) => setCarData({ ...carData, engine: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-slate-500 font-bold font-mono">
                  Mileage (km)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 65000"
                  value={carData.mileage || ''}
                  onChange={(e) => setCarData({ ...carData, mileage: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Key Features Input + One-Click Presets */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <label className="text-xs uppercase tracking-wider text-slate-700 font-bold font-mono flex items-center gap-1.5">
                <Tag size={13} className="text-amber-500" />
                <span>Key Features ({currentFeatures.length})</span>
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a key feature (e.g. Panoramic Sunroof) and press Add..."
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddFeature(featureInput);
                    }
                  }}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddFeature(featureInput)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs rounded-xl cursor-pointer shrink-0"
                >
                  Add Feature
                </button>
              </div>

              {/* Active Feature Tags */}
              {currentFeatures.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {currentFeatures.map((feat) => (
                    <span
                      key={feat}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-semibold"
                    >
                      <span>{feat}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFeature(feat)}
                        className="text-slate-400 hover:text-amber-400 cursor-pointer"
                        aria-label={`Remove ${feat}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Quick Suggestions */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTED_KEY_FEATURES.filter(
                  (s) => !currentFeatures.some((f) => f.toLowerCase() === s.toLowerCase())
                ).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleAddFeature(preset)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 text-slate-700 text-[11px] font-medium cursor-pointer transition-colors"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-slate-700 font-bold font-mono">
                Vehicle Sourcing Description *
              </label>
              <textarea
                required
                rows={4}
                placeholder="List interior condition, mechanical health, verified customs papers, accident-free status, and inspection notes..."
                value={carData.description || ''}
                onChange={(e) => setCarData({ ...carData, description: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Featured & Slideshow Placement */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={carData.isFeatured ?? true}
                  onChange={(e) => setCarData({ ...carData, isFeatured: e.target.checked })}
                  className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"
                />
                <span className="text-xs font-bold text-slate-800">Mark as Featured on Homepage</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={carData.inSlideshow ?? true}
                  onChange={(e) => setCarData({ ...carData, inSlideshow: e.target.checked })}
                  className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400"
                />
                <span className="text-xs font-bold text-slate-800">Include in Hero Slideshow</span>
              </label>
            </div>
          </div>
        </section>

        {/* =================================================================== */}
        {/* STEP 3 & STEP 4: REVIEW SUMMARY & PUBLISH VEHICLE                   */}
        {/* =================================================================== */}
        <section className="rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase tracking-widest bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md">
                STEP 3 & 4
              </span>
              <h3 className="text-sm sm:text-base font-bold font-display">
                Review Summary & Publish Vehicle
              </h3>
            </div>
            <Sparkles size={16} className="text-amber-400" />
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
              {/* Cover Preview */}
              <div className="md:col-span-3">
                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">
                  {photoCards[0] ? (
                    <img
                      src={
                        photoCards[0].uploadedUrl
                          ? getOptimizedImageUrl(photoCards[0].uploadedUrl, 'thumb')
                          : getImageUrl(photoCards[0].previewUrl)
                      }
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] font-mono text-slate-500 px-3 text-center">
                      No Cover Photo
                    </span>
                  )}
                </div>
              </div>

              {/* Listing Summary */}
              <div className="md:col-span-9 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="col-span-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                    Vehicle Listing
                  </span>
                  <span className="text-sm font-bold text-white block truncate mt-0.5">
                    {carData.year || 2021} {carData.make || 'Make'} {carData.model || 'Model'}
                  </span>
                  <span className="text-xs font-mono text-amber-400 font-bold block mt-0.5">
                    {formatCurrency(Number(carData.price) || 0)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                    Photos Uploaded
                  </span>
                  <span
                    className={`text-sm font-mono font-bold block mt-0.5 ${
                      completedCount > 0 && failedCount === 0 && activeCount === 0
                        ? 'text-emerald-400'
                        : 'text-amber-300'
                    }`}
                  >
                    {completedCount} / {photoCards.length} Ready
                  </span>
                  {failedCount > 0 && (
                    <span className="text-[10px] text-rose-400 font-mono block">
                      {failedCount} failed
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                    Condition & Duty
                  </span>
                  <span className="text-xs font-semibold text-white block mt-0.5 truncate">
                    {carData.condition || 'Foreign Used'}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {carData.dutyStatus || 'Full Customs Duty Paid'}
                  </span>
                </div>
              </div>
            </div>

            {/* Publish Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {isPublishing ? (
                <div className="flex items-center gap-2.5 text-xs font-mono text-amber-300 bg-slate-900 border border-amber-500/30 px-4 py-2.5 rounded-xl">
                  <Loader2 size={16} className="animate-spin text-amber-400 shrink-0" />
                  <span className="font-bold">{publishStatusText || 'Publishing vehicle...'}</span>
                </div>
              ) : (
                <span className="text-xs text-slate-400 font-mono">
                  {activeCount > 0
                    ? `Uploading ${activeCount} photograph(s) to Cloudinary — publish unlocks automatically on completion.`
                    : failedCount > 0
                    ? 'Resolve failed photo upload(s) above before publishing.'
                    : 'All changes save directly to Cloud Firestore and appear on Jite Auto Deals immediately.'}
                </span>
              )}

              <button
                type="submit"
                disabled={isPublishing || activeCount > 0 || failedCount > 0 || photoCards.length === 0}
                className={`flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-black text-sm tracking-wide shadow-xl transition-all cursor-pointer w-full sm:w-auto uppercase ${
                  isPublishing || activeCount > 0 || failedCount > 0 || photoCards.length === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-98 shadow-amber-500/20'
                }`}
              >
                {isPublishing ? (
                  <Loader2 size={18} className="animate-spin text-amber-400" />
                ) : (
                  <Save size={18} className="text-slate-950" />
                )}
                <span>
                  {isPublishing
                    ? 'PUBLISHING VEHICLE...'
                    : editingCar?.id
                    ? 'UPDATE VEHICLE LISTING'
                    : 'PUBLISH VEHICLE'}
                </span>
              </button>
            </div>
          </div>
        </section>
      </form>

      {/* ===================================================================== */}
      {/* FULL-SIZE IMAGE PREVIEW LIGHTBOX MODAL                                */}
      {/* ===================================================================== */}
      {lightboxIndex !== null && photoCards[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex flex-col justify-between p-4 sm:p-6"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="flex items-center justify-between text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-0.5">
              <p className="text-xs font-mono text-amber-400 font-bold">
                Photo #{lightboxIndex + 1} of {photoCards.length}
                {lightboxIndex === 0 ? ' · Cover Photo' : ''}
              </p>
              <p className="text-xs text-slate-300 font-mono truncate max-w-xs sm:max-w-lg">
                {photoCards[lightboxIndex].fileName}
                {photoCards[lightboxIndex].width && photoCards[lightboxIndex].height
                  ? ` · ${photoCards[lightboxIndex].width}×${photoCards[lightboxIndex].height}px`
                  : ''}
                {photoCards[lightboxIndex].bytes
                  ? ` · ${formatFileSize(photoCards[lightboxIndex].bytes!)}`
                  : ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {lightboxIndex > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    handleSetPrimary(lightboxIndex);
                    setLightboxIndex(0);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs cursor-pointer"
                >
                  Make Cover
                </button>
              )}
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                aria-label="Close preview"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div
            className="relative flex-1 flex items-center justify-center my-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={
                photoCards[lightboxIndex].uploadedUrl
                  ? getOptimizedImageUrl(photoCards[lightboxIndex].uploadedUrl, 'fullscreen')
                  : getImageUrl(photoCards[lightboxIndex].previewUrl)
              }
              alt={`Preview #${lightboxIndex + 1}`}
              className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl"
            />

            {photoCards.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxIndex((lightboxIndex - 1 + photoCards.length) % photoCards.length)
                  }
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center cursor-pointer border border-white/20"
                  aria-label="Previous photo"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxIndex((lightboxIndex + 1) % photoCards.length)}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center cursor-pointer border border-white/20"
                  aria-label="Next photo"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
