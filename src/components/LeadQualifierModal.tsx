import React from 'react';
import { Vehicle, BusinessSettings } from '../types';
import InspectionBookingModal from './InspectionBookingModal';

interface LeadQualifierModalProps {
  vehicle: Vehicle | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenConsultantModal?: (vehicle: Vehicle, customMsg?: string) => void;
  businessSettings?: BusinessSettings;
}

export default function LeadQualifierModal({
  vehicle,
  isOpen,
  onClose,
  businessSettings,
}: LeadQualifierModalProps) {
  return (
    <InspectionBookingModal
      vehicle={vehicle}
      isOpen={isOpen}
      onClose={onClose}
      businessSettings={businessSettings}
    />
  );
}
