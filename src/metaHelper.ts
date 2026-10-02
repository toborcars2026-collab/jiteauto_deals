import type { Vehicle } from './types';

export interface ImageDimensionsInfo {
  width?: number;
  height?: number;
  type?: string;
}

export interface PageMetadata {
  title: string;
  description: string;
  image: string;
  imageSecureUrl?: string;
  imageType?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageAlt: string;
  url: string;
  type: string;
  siteName: string;
  locale: string;
  twitterCard: 'summary_large_image' | 'summary';
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  twitterImageAlt: string;
  canonicalUrl: string;
  keywords?: string;
  vehicle?: Vehicle | null;
}

export const DEFAULT_BRAND_IMAGE =
  'https://res.cloudinary.com/xh0efm5e/image/upload/c_fill,w_1200,h_630,q_auto:good,f_jpg/v1790903435/wide_cinematic_high_contrast_promotional_banner.jpg';
export const DEFAULT_BRAND_IMAGE_TYPE = 'image/jpeg';
export const DEFAULT_BRAND_IMAGE_WIDTH = 1200;
export const DEFAULT_BRAND_IMAGE_HEIGHT = 630;
export const DEFAULT_BRAND_IMAGE_ALT = 'Jite Auto Deals — Trusted Vehicle Consultant in Nigeria';

export const DEFAULT_SITE_NAME = 'Jite Auto Deals';
export const DEFAULT_LOCALE = 'en_NG';
export const DEFAULT_BASE_URL = 'https://jiteautodealss.vercel.app';

export const FIREBASE_PROJECT_ID = 'gen-lang-client-0327661147';
export const FIRESTORE_DATABASE_ID = 'ai-studio-jiteautodeals-74aa2960-b1e2-41ac-9714-42ee44c5712a';

const KNOWN_IMGBB_MAP: Record<string, string> = {
  'FbMN1Pdd': 'https://i.ibb.co/fY5BWcTT/IMG-20260821-WA0006.jpg',
  'RTgSG1gx': 'https://i.ibb.co/WvH3NQHb/IMG-20260821-WA0012.jpg',
  '4gPF1WJ5': 'https://i.ibb.co/x8J2Fh3R/IMG-20260821-WA0016.jpg',
  'G4G0VhDW': 'https://i.ibb.co/B5vtg1Jy/IMG-20260821-WA0014.jpg',
  '6J09NPP2': 'https://i.ibb.co/DgfcLCCN/IMG-20260821-WA0018.jpg',
  'vvQrXdRk': 'https://i.ibb.co/93VfZ4SW/IMG-20260821-WA0000.jpg',
  'PZ38L9XG': 'https://i.ibb.co/gMHC2PqZ/IMG-20260821-WA0001.jpg',
  'prPMnkmw': 'https://i.ibb.co/wrLPY2vg/IMG-20260821-WA0004.jpg',
  'dwQVvFQs': 'https://i.ibb.co/0Rf6LTfp/IMG-20260821-WA0002.jpg',
  'TMSWnYQF': 'https://i.ibb.co/fd5DKq3P/IMG-20260821-WA0003.jpg',
  '359fpyvg': 'https://i.ibb.co/Myx8cDfF/IMG-20260819-WA0012.jpg',
  'prBSRtyr': 'https://i.ibb.co/M5xmGY65/IMG-20260819-WA0016.jpg',
  'PvgXDknN': 'https://i.ibb.co/W4f8VCw6/IMG-20260819-WA0018.jpg',
  'JRZGVMQh': 'https://i.ibb.co/PZkPKfQS/IMG-20260819-WA0020.jpg',
  'v6c4shvf': 'https://i.ibb.co/hJgFXc1r/IMG-20260819-WA0014.jpg',
  'LDNWGn6K': 'https://i.ibb.co/8nYph62k/IMG-20260819-WA0002.jpg',
  'gcbjvcp': 'https://i.ibb.co/mPrDvPw/IMG-20260819-WA0004.jpg',
  'ZzKMS9Ct': 'https://i.ibb.co/4RMV2kx9/IMG-20260819-WA0008.jpg',
  'yBdT1XYS': 'https://i.ibb.co/mFbswGX8/IMG-20260819-WA0006.jpg',
  'wZtKS2Yy': 'https://i.ibb.co/JWZzvSCn/IMG-20260819-WA0010.jpg',
  'XZvJcrKp': 'https://i.ibb.co/Kj3yTpf7/IMG-20260820-WA0010.jpg',
  'Lzpbc58J': 'https://i.ibb.co/1f2hP6Ld/IMG-20260820-WA0009.jpg',
  'skjWZJ0': 'https://i.ibb.co/yG04rBw/IMG-20260820-WA0014.jpg',
  'Cp5DT1cW': 'https://i.ibb.co/BHVFSzpw/IMG-20260820-WA0013.jpg',
  'tpFsmFqK': 'https://i.ibb.co/3mQNrQpd/IMG-20260820-WA0017.jpg',
  'S7XwDCwm': 'https://i.ibb.co/zHhVWvV2/IMG-20260730-WA0041.jpg',
  '8gYZRD6R': 'https://i.ibb.co/v4XnrxZr/IMG-20260730-WA0048.jpg',
  'BHBsT1DZ': 'https://i.ibb.co/zWZfPkcR/IMG-20260730-WA0049.jpg',
  '7xN3nXf7': 'https://i.ibb.co/5XxQr60q/IMG-20260730-WA0050.jpg',
  'S4RSRySF': 'https://i.ibb.co/4nPkPtkh/IMG-20260730-WA0052.jpg',
  'ynQB0P8m': 'https://i.ibb.co/wNzrygKZ/IMG-20260730-WA0051.jpg',
  'yncjHgxK': 'https://i.ibb.co/Gv4SzCrG/IMG-20260730-WA0047.jpg',
  '5XL9LFbM': 'https://i.ibb.co/hxVMVf37/IMG-20260730-WA0032.jpg',
  'FkfCd8df': 'https://i.ibb.co/rKLNX5XL/IMG-20260730-WA0035.jpg',
  'N2rv6xVq': 'https://i.ibb.co/KxDPj60g/IMG-20260730-WA0036.jpg',
  'PGqLXrsK': 'https://i.ibb.co/MkFvwgyr/IMG-20260730-WA0039.jpg',
  'Swz3WG5C': 'https://i.ibb.co/1Gkmhj7W/IMG-20260730-WA0040.jpg',
  'GQBwvLVC': 'https://i.ibb.co/Jj0LR4zr/IMG-20260730-WA0022.jpg',
  'LDLLnD3S': 'https://i.ibb.co/20DDg0Tq/IMG-20260730-WA0024.jpg',
  'gFd1qHsb': 'https://i.ibb.co/4g2yv9Bw/IMG-20260730-WA0026.jpg',
  'q3DsWcKw': 'https://i.ibb.co/v6cPQTp8/IMG-20260730-WA0028.jpg',
  '1YhCcNtY': 'https://i.ibb.co/KcRtngpc/IMG-20260730-WA0030.jpg',
  'fYhkvtss': 'https://i.ibb.co/6R3HBbkk/IMG-20260729-WA0002.jpg',
  'SXh2xmJR': 'https://i.ibb.co/tM7Sh238/IMG-20260729-WA0003.jpg',
  'yBs2zzW9': 'https://i.ibb.co/rfy9BB4j/IMG-20260729-WA0012.jpg',
  'gbBdws3x': 'https://i.ibb.co/fVP9tm2s/IMG-20260729-WA0016.jpg',
  'SXj7gSSZ': 'https://i.ibb.co/5W0x3ZZJ/IMG-20260729-WA0017.jpg',
  'vvkG4czB': 'https://i.ibb.co/n8jvMwk0/IMG-20260729-WA0018.jpg',
  'vx10V7m6': 'https://i.ibb.co/gMykm5wL/IMG-20260729-WA0022.jpg',
  'cSpyPtnL': 'https://i.ibb.co/sdDghQYH/IMG-20260729-WA0012.jpg',
  'cKYFSVv5': 'https://i.ibb.co/BHnZ5FPD/IMG-20260803-WA0012.jpg',
  'XxQLVtBM': 'https://i.ibb.co/1GgQbTVj/IMG-20260803-WA0014.jpg',
  'v4bPVjNS': 'https://i.ibb.co/7tHWj13q/IMG-20260803-WA0016.jpg',
  'XrJywthH': 'https://i.ibb.co/gLgvnJ5Y/IMG-20260803-WA0018.jpg',
  'RG8N3KxC': 'https://i.ibb.co/bjtFsVSr/IMG-20260803-WA0020.jpg',
  'QtzNd3Q': 'https://i.ibb.co/6LVPB7w/IMG-20260805-WA0004.jpg',
  'Y4vMxZPL': 'https://i.ibb.co/zWKYzJQ4/IMG-20260805-WA0008.jpg',
  'zh3xKGxb': 'https://i.ibb.co/5WQ4qB4v/IMG-20260805-WA0006.jpg',
  '97KSV8L': 'https://i.ibb.co/gxqhPjp/IMG-20260805-WA0010.jpg',
  'n8B7sx2z': 'https://i.ibb.co/QjkPFyBr/IMG-20260805-WA0012.jpg',
  'HfXqM9tM': 'https://i.ibb.co/YFbhKVcK/IMG-20260805-WA0016.jpg',
  'vC4TY8s1': 'https://i.ibb.co/XfxK8TyX/IMG-20260805-WA0020.jpg',
  'R4CQFPL3': 'https://i.ibb.co/Dg7wJk39/IMG-20260805-WA0018.jpg',
  'mrjT6xzY': 'https://i.ibb.co/vCFqZtzr/IMG-20260805-WA0022-1.jpg',
  'B5cmmcKP': 'https://i.ibb.co/nN6TT680/IMG-20260805-WA0024.jpg',
  '218GLZJw': 'https://i.ibb.co/C3JRXPLq/IMG-20260805-WA0069.jpg',
  'qLL3M38j': 'https://i.ibb.co/MyyxDxHS/IMG-20260805-WA0071.jpg',
  'k68TnQgn': 'https://i.ibb.co/Lhtywnzw/IMG-20260805-WA0073.jpg',
  'cXhFLgwX': 'https://i.ibb.co/BK2ZNzGK/IMG-20260805-WA0075.jpg',
  'prZ31ysJ': 'https://i.ibb.co/sJQFgHDy/IMG-20260805-WA0077.jpg',
  'ccBkx39G': 'https://i.ibb.co/gM2m6985/IMG-20260805-WA0079.jpg',
  '5XFLD3Q3': 'https://i.ibb.co/xKH6vbnb/IMG-20260807-WA0002.jpg',
  'Fk2GbP3j': 'https://i.ibb.co/rKYnGW01/IMG-20260807-WA0003.jpg',
  'hxVKXbj4': 'https://i.ibb.co/5XL5YmyS/IMG-20260807-WA0005.jpg',
  'bgRQVYdj': 'https://i.ibb.co/TBqYGJhD/IMG-20260807-WA0007.jpg',
  'TV5YKJy': 'https://i.ibb.co/CkFmJ4L/IMG-20260805-WA0081.jpg',
  'k2vNv3pv': 'https://i.ibb.co/F4CRCs9C/IMG-20260807-WA0010.jpg',
  '7t2CWvfR': 'https://i.ibb.co/Wvg5ynhP/IMG-20260807-WA0017.jpg',
  'hRD78rTm': 'https://i.ibb.co/Z6WLTvbM/IMG-20260807-WA0016.jpg',
  '4ZbyR1Q7': 'https://i.ibb.co/6RKh0Xdm/IMG-20260807-WA0015.jpg',
  'gbWs5TzZ': 'https://i.ibb.co/dspnd2G4/IMG-20260807-WA0014.jpg',
  '665Y81X': 'https://i.ibb.co/QsG9kCD/IMG-20260807-WA0019.jpg',
  'gZ5PyRG6': 'https://i.ibb.co/ZznYdM3N/IMG-20260807-WA0027.jpg',
  'ZRLhZ75C': 'https://i.ibb.co/RGvC5dfW/IMG-20260807-WA0024.jpg',
  'wZ5zdnrN': 'https://i.ibb.co/BH0CfhKV/IMG-20260807-WA0026.jpg',
  'G4bFkgVZ': 'https://i.ibb.co/tTW3cyb0/IMG-20260807-WA0025.jpg',
  'hxrhq75X': 'https://i.ibb.co/WN7qTx9D/IMG-20260811-WA0030.jpg',
  '8gJZkTyb': 'https://i.ibb.co/WvQJCqr0/IMG-20260811-WA0036.jpg',
  'xPmNvNm': 'https://i.ibb.co/d1bR9Rb/IMG-20260811-WA0037.jpg',
  'Kjd4T093': 'https://i.ibb.co/0jT4HDfd/IMG-20260811-WA0038.jpg',
  'N6k1R01G': 'https://i.ibb.co/6RpvQKvq/IMG-20260811-WA0032.jpg',
  'CF0svRr': 'https://i.ibb.co/w16rC5v/IMG-20260811-WA0050.jpg',
  'gFtZGB74': 'https://i.ibb.co/WpBvQY3V/IMG-20260811-WA0045.jpg',
  'FP22yqX': 'https://i.ibb.co/vtppTvh/IMG-20260811-WA0049.jpg',
  '27SdB4g5': 'https://i.ibb.co/FbXztTgn/IMG-20260811-WA0048.jpg',
  'j9hq6Hjc': 'https://i.ibb.co/BHLvzwYX/IMG-20260811-WA0047.jpg',
  'zT44cCK7': 'https://i.ibb.co/VcqqybXQ/IMG-20260811-WA0065.jpg',
  '1tnrSMXK': 'https://i.ibb.co/RkS35N6P/IMG-20260811-WA0068.jpg',
  'C5dxKkCJ': 'https://i.ibb.co/JRLXjf6x/IMG-20260811-WA0067.jpg',
  '9m9pv9hg': 'https://i.ibb.co/spvgPvCR/IMG-20260811-WA0069.jpg',
  'Nn6qb8mM': 'https://i.ibb.co/zHhgDy7z/IMG-20260811-WA0066.jpg',
  'd4HLZZTx': 'https://i.ibb.co/s9X677fz/IMG-20260811-WA0071.jpg',
  'gLJRqP4X': 'https://i.ibb.co/Mx7CwGBj/IMG-20260811-WA0076.jpg',
  'mr5RC3Yk': 'https://i.ibb.co/PsGrZdbK/IMG-20260811-WA0077.jpg',
  'qYm3rFkm': 'https://i.ibb.co/b5NMKRzN/IMG-20260811-WA0079.jpg',
  '8nTtfc05': 'https://i.ibb.co/5XtwSF68/IMG-20260811-WA0073.jpg',
  'Z6DLgts8': 'https://i.ibb.co/3yZrFGXN/IMG-20260811-WA0081.jpg',
  '21kbRL9v': 'https://i.ibb.co/Pv6SJbLc/IMG-20260811-WA0083.jpg',
  'WWQb5zZt': 'https://i.ibb.co/gMG59WNV/IMG-20260811-WA0088.jpg',
  'qMv3DNRw': 'https://i.ibb.co/KjJp529H/IMG-20260811-WA0089.jpg',
  'C3fZ0Rm6': 'https://i.ibb.co/sdZG38bC/IMG-20260811-WA0087.jpg',
  'VYJ9tq2d': 'https://i.ibb.co/gZm93RzG/IMG-20260811-WA0092.jpg',
  'b0mB7VY': 'https://i.ibb.co/7fCWbDB/IMG-20260811-WA0097.jpg',
  '5fmWnLs': 'https://i.ibb.co/ybtnYqg/IMG-20260811-WA0099.jpg',
  'hFsWng15': 'https://i.ibb.co/MknVjg5T/IMG-20260811-WA0094.jpg',
  'zWV2W472': 'https://i.ibb.co/p6jK6LRK/IMG-20260811-WA0096.jpg',
  'NgCgFgtj': 'https://i.ibb.co/Fk3khkmw/IMG-20260811-WA0101.jpg',
  't1j3dBZ': 'https://i.ibb.co/40vJQWs/IMG-20260811-WA0103.jpg',
  '8g2kYSrk': 'https://i.ibb.co/b5Ltb8st/IMG-20260811-WA0109.jpg',
  'Z6zD08t5': 'https://i.ibb.co/wNhmfW3V/IMG-20260811-WA0108.jpg',
  'bpSXkXd': 'https://i.ibb.co/qbtpvp1/IMG-20260811-WA0107.jpg',
  'PvQ5N8ZY': 'https://i.ibb.co/1t69Lxfn/IMG-20260811-WA0111.jpg',
  'Z1kRFsc8': 'https://i.ibb.co/DgSPvXwC/IMG-20260811-WA0117.jpg',
  '5Wk69Trh': 'https://i.ibb.co/27Sy6qv3/IMG-20260811-WA0118.jpg',
  'YTYcKyzv': 'https://i.ibb.co/LhbxqJL4/IMG-20260811-WA0115.jpg',
  '8nzqT3rH': 'https://i.ibb.co/wZJV3HSf/IMG-20260811-WA0119.jpg',
  'NdrXskvs': 'https://i.ibb.co/cSwP1pB1/IMG-20260811-WA0121.jpg',
  '9kN4jDXm': 'https://i.ibb.co/397FH3X5/IMG-20260811-WA0127.jpg',
  '27f4xZVN': 'https://i.ibb.co/VWP4Rwnm/IMG-20260811-WA0125.jpg',
  's9wsjgG1': 'https://i.ibb.co/60PDYyxt/IMG-20260811-WA0128.jpg',
  '4wNWXZzP': 'https://i.ibb.co/cKTJZc0D/IMG-20260811-WA0129.jpg',
  'JwZdMxt1': 'https://i.ibb.co/Q30c18Qg/IMG-20260808-WA0015.jpg',
  '4R05LfDf': 'https://i.ibb.co/xqrRbscs/IMG-20260811-WA0134.jpg',
  '7xNxVD92': 'https://i.ibb.co/Kczc7g1F/IMG-20260811-WA0135.jpg',
  'DgDbvgjQ': 'https://i.ibb.co/R4pSs4Jc/IMG-20260811-WA0136.jpg',
  'nM3RM6Cc': 'https://i.ibb.co/23853WNt/IMG-20260811-WA0137.jpg',
  '3yj0mWVw': 'https://i.ibb.co/VWzvYDbd/IMG-20260808-WA0016.jpg',
  '0VYY4StJ': 'https://i.ibb.co/n8QQdvCk/IMG-20260811-WA0139.jpg',
  'F4zRN7f7': 'https://i.ibb.co/b5Xcqdyd/IMG-20260811-WA0149.jpg',
  'wH4w5qr': 'https://i.ibb.co/W9fPmXp/IMG-20260811-WA0144.jpg',
  'Lz7pxgGm': 'https://i.ibb.co/JRJkvphV/IMG-20260811-WA0142.jpg',
  '0jt1qmpN': 'https://i.ibb.co/99tBncmX/IMG-20260811-WA0147.jpg',
  'bgrv8dFX': 'https://i.ibb.co/3y0FLhvc/IMG-20260811-WA0148.jpg',
  'wh1kJ1yT': 'https://i.ibb.co/tp5GZ5BS/IMG-20260811-WA0154.jpg',
  'gZWJqkx3': 'https://i.ibb.co/Xx5t0cqb/IMG-20260811-WA0157.jpg',
  'JwVcLzdf': 'https://i.ibb.co/S4b6TKxh/IMG-20260811-WA0156.jpg',
  'Y4vw7sWx': 'https://i.ibb.co/CpxD5Gtf/IMG-20260811-WA0155.jpg',
  'Df6p0rBw': 'https://i.ibb.co/GQ1TzHZC/IMG-20260811-WA0159.jpg',
  'FFfJnSS': 'https://i.ibb.co/Q4qnX22/IMG-20260811-WA0161.jpg',
  '60fdNKRM': 'https://i.ibb.co/5hf72QW0/IMG-20260728-WA0030.jpg',
  '21m3wXsT': 'https://i.ibb.co/RkZT1LBq/IMG-20260728-WA0032.jpg',
  'CKqf709N': 'https://i.ibb.co/8gJH58xT/IMG-20260811-WA0163.jpg',
  'MxM3t1C8': 'https://i.ibb.co/gLzBfWRv/IMG-20260811-WA0165.jpg',
  '0pDPJxh6': 'https://i.ibb.co/nqghkFzY/IMG-20260811-WA0166.jpg',
  'pj0zhHNv': 'https://i.ibb.co/m5DqNndC/IMG-20260814-WA0028.jpg',
  'jk88P4VJ': 'https://i.ibb.co/xq22t5mF/IMG-20260815-WA0000.jpg',
  'NdvZK076': 'https://i.ibb.co/RkFzcX7p/IMG-20260815-WA0001.jpg',
  '5hhGR0JG': 'https://i.ibb.co/Jjjms1Sm/IMG-20260815-WA0002.jpg',
  'SDqNr6v3': 'https://i.ibb.co/nqhrCwkL/IMG-20260815-WA0003.jpg',
  '4gsH1PrF': 'https://i.ibb.co/TqKsWm3w/IMG-20260814-WA0011.jpg',
  'WvL66pHf': 'https://i.ibb.co/5hP66x1L/IMG-20260814-WA0014.jpg',
  'TBg6zZP8': 'https://i.ibb.co/vxjp2bLP/IMG-20260815-WA0004.jpg',
  'pvxD8fwy': 'https://i.ibb.co/cc15H63L/IMG-20260815-WA0005.jpg',
  'cXNJDpLG': 'https://i.ibb.co/fGCM4Kvh/IMG-20260815-WA0006.jpg',
  'wh3DH1GC': 'https://i.ibb.co/GQBgwjYk/IMG-20260815-WA0007.jpg',
  'Qj8DHjwZ': 'https://i.ibb.co/CsJP9sGq/IMG-20260814-WA0030.jpg',
  'WpyLdPr2': 'https://i.ibb.co/Lht3qJTZ/IMG-20260815-WA0009.jpg',
  'zkLGFMq': 'https://i.ibb.co/VKh2x1f/IMG-20260815-WA0011.jpg',
  'YBSPHCHm': 'https://i.ibb.co/B2Jc0p0b/IMG-20260814-WA0013.jpg',
  'ycnnJVfQ': 'https://i.ibb.co/q3MMwxyr/IMG-20260814-WA0015.jpg',
  'QvDFrSgf': 'https://i.ibb.co/TMWBmjfk/IMG-20260815-WA0013.jpg',
  'yB0tkmpc': 'https://i.ibb.co/0VqT9pKR/IMG-20260815-WA0017.jpg',
  'KpGLyCLn': 'https://i.ibb.co/sdP63L67/IMG-20260815-WA0022.jpg',
  'gbxp2RjT': 'https://i.ibb.co/kVtf7SH8/IMG-20260815-WA0019.jpg',
  'P8qWgCR': 'https://i.ibb.co/8V1x98J/IMG-20260815-WA0023.jpg',
  'BV2hjpfb': 'https://i.ibb.co/3ymxW3T2/IMG-20260815-WA0018.jpg',
  'ccDk4W41': 'https://i.ibb.co/zhGQq3qr/IMG-20260815-WA0025.jpg',
  '99wcKkxV': 'https://i.ibb.co/mCvbZVnX/IMG-20260815-WA0027.jpg',
  'fGxXQFtB': 'https://i.ibb.co/HpHKX4Y1/IMG-20260815-WA0031.jpg',
  'Wp7FyFJP': 'https://i.ibb.co/HpRYzY8x/IMG-20260815-WA0029.jpg',
  '21hxHXth': 'https://i.ibb.co/MxSrQqVS/IMG-20260815-WA0033.jpg',
  'yBVWpSLG': 'https://i.ibb.co/wrYM7sD3/IMG-20260815-WA0043.jpg',
  'zV7NvhJb': 'https://i.ibb.co/whwYmNsC/IMG-20260815-WA0045.jpg',
  '8Dv5bnX3': 'https://i.ibb.co/hRQWcxC5/IMG-20260815-WA0044.jpg',
  'v6bZj3HM': 'https://i.ibb.co/tTS8Jq41/IMG-20260815-WA0047.jpg',
  '0RGHhQ8Y': 'https://i.ibb.co/XrCcSVNF/IMG-20260815-WA0049.jpg',
  'k2D20vVT': 'https://i.ibb.co/jkwkGs9Y/IMG-20260822-WA0001.jpg',
  'qLr3GPg7': 'https://i.ibb.co/ymQcTbkd/IMG-20260822-WA0007.jpg',
  'Kzjctrv0': 'https://i.ibb.co/M5DyzC02/IMG-20260822-WA0008.jpg',
  'B2X04c1v': 'https://i.ibb.co/qYtT07Zh/IMG-20260822-WA0006.jpg',
  'RK9KQzZ': 'https://i.ibb.co/q8d8mkX/IMG-20260822-WA0009.jpg',
  'LXNPfbqK': 'https://i.ibb.co/XrY4TNdH/IMG-20260822-WA0023.jpg',
  '4wtLBNCZ': 'https://i.ibb.co/gb98sgQM/IMG-20260823-WA0001.jpg',
  'wFgz95nS': 'https://i.ibb.co/ycPQwHz6/IMG-20260822-WA0027.jpg',
  'ns2zckZW': 'https://i.ibb.co/rGP46yTW/IMG-20260821-WA0008.jpg',
  '93mdrM57': 'https://i.ibb.co/Qj7xK5w4/IMG-20260822-WA0026.jpg',
  'Ld7GkJzh': 'https://i.ibb.co/4RrQmYZg/IMG-20260822-WA0015.jpg',
  'ZRNz6TGh': 'https://i.ibb.co/Kcmxjyb9/IMG-20260822-WA0019.jpg',
  'xtbSs7Jy': 'https://i.ibb.co/7dDJz12H/IMG-20260822-WA0021.jpg',
  'qF52Cz0N': 'https://i.ibb.co/M56Jfb8c/IMG-20260822-WA0020.jpg',
  '8448X6Fq': 'https://i.ibb.co/cXXTxDz0/IMG-20260822-WA0013.jpg',
  'VYD3wzNj': 'https://i.ibb.co/DfkLrvbV/IMG-20260822-WA0018.jpg',
  'XkvcW0vF': 'https://i.ibb.co/qFPTDqPm/IMG-20260822-WA0001-1.jpg',
  'q4Mp2yK': 'https://i.ibb.co/G1vRrxy/IMG-20260822-WA0007-1.jpg',
  'tMsfP0Qd': 'https://i.ibb.co/pvzDrHbm/IMG-20260822-WA0006-1.jpg',
  'BVWRkWS1': 'https://i.ibb.co/1fyxcywS/IMG-20260822-WA0008-1.jpg',
  'XZVLLfBC': 'https://i.ibb.co/Fbn33kvD/IMG-20260822-WA0009-1.jpg',
  'rK3GHvJP': 'https://i.ibb.co/SDcXBJpT/IMG-20260820-WA0021.jpg',
  'rRZd4dDJ': 'https://i.ibb.co/W4cVgVm1/IMG-20260824-WA0003.jpg',
  'fdSDx0Bv': 'https://i.ibb.co/pjPhLXGy/IMG-20260824-WA0006.jpg',
  'Zzq98DSN': 'https://i.ibb.co/LdVKt7rv/IMG-20260824-WA0008.jpg',
  'G4q4ZMQJ': 'https://i.ibb.co/Xrqrn5x4/IMG-20260824-WA0009.jpg',
  'TFhp7VM': 'https://i.ibb.co/3LhGjDm/IMG-20260824-WA0035.jpg',
  '0VX6qWkW': 'https://i.ibb.co/6JZTYp2p/IMG-20260824-WA0037.jpg',
  'zTkQHyyg': 'https://i.ibb.co/9kMc3FF0/IMG-20260824-WA0039.jpg',
  'xKHyhFGz': 'https://i.ibb.co/LD5MSN69/IMG-20260824-WA0041.jpg',
  'qLRL8MDv': 'https://i.ibb.co/cKNK9cyj/IMG-20260824-WA0016.jpg',
  'MzVFHst': 'https://i.ibb.co/LTtVy8c/IMG-20260824-WA0011.jpg',
  'LdbPtk06': 'https://i.ibb.co/CKNt71wv/IMG-20260824-WA0023.jpg',
  'ychj9h89': 'https://i.ibb.co/KpNvPN9P/IMG-20260824-WA0018.jpg',
  'dHm6t4q': 'https://i.ibb.co/SZf0cw8/IMG-20260824-WA0021.jpg',
  '998YmLBw': 'https://i.ibb.co/N6VYgPf1/IMG-20260824-WA0019.jpg',
  'bgnV74MS': 'https://i.ibb.co/GvjDFZ4K/IMG-20260824-WA0025.jpg',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatMileage(km: number): string {
  return new Intl.NumberFormat('en-US').format(km) + ' km';
}

export function decodeUnicodeEscapes(str: string | undefined | null): string {
  if (!str || typeof str !== 'string') return '';
  let res = str;

  res = res.replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, hex) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });

  res = res.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCharCode(code) : _;
    } catch {
      return _;
    }
  });

  res = res.replace(/\\U([0-9a-fA-F]{8})/g, (_, hex) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });

  res = res.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => {
    try {
      const code = parseInt(hex, 16);
      return String.fromCharCode(code);
    } catch {
      return _;
    }
  });

  res = res.replace(/&#x([0-9a-fA-F]{1,6});/gi, (_, hex) => {
    try {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });

  res = res.replace(/&#([0-9]{1,7});/g, (_, dec) => {
    try {
      const code = parseInt(dec, 10);
      return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : _;
    } catch {
      return _;
    }
  });

  res = res.replace(/^2728\s+/g, '✨ ');
  res = res.replace(/\s+2728$/g, ' ✨');
  res = res.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');

  return res;
}

export function normalizeImageUrlForMeta(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return '';
  }

  if (trimmed.includes('ibb.co/') && !trimmed.includes('i.ibb.co/')) {
    const match = trimmed.match(/ibb\.co\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      const code = match[1];
      if (KNOWN_IMGBB_MAP[code]) {
        return KNOWN_IMGBB_MAP[code];
      }
      return `https://i.ibb.co/${code}/image.jpg`;
    }
  }

  if (trimmed.includes('drive.google.com/file/d/')) {
    const match = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }

  if (trimmed.includes('imgur.com/') && !trimmed.includes('i.imgur.com/')) {
    const match = trimmed.match(/imgur\.com\/(?:a\/)?([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return `https://i.imgur.com/${match[1]}.jpg`;
    }
  }

  if (trimmed.includes('dropbox.com/s/')) {
    return trimmed.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
  }

  if (trimmed.includes('postimg.cc/') && !trimmed.includes('i.postimg.cc/')) {
    const match = trimmed.match(/postimg\.cc\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return `https://i.postimg.cc/${match[1]}/image.jpg`;
    }
  }

  return trimmed;
}

export function getPrimaryVehicleImage(vehicle: Vehicle | null | undefined): string {
  if (!vehicle) return '';
  const explicitPrimary = (vehicle as any).primaryImage;
  if (typeof explicitPrimary === 'string' && explicitPrimary.trim()) {
    const normalized = normalizeImageUrlForMeta(explicitPrimary);
    if (normalized) return normalized;
  }

  if (Array.isArray(vehicle.images)) {
    for (const img of vehicle.images) {
      const normalized = normalizeImageUrlForMeta(img);
      if (normalized) return normalized;
    }
  }

  return '';
}

export function inferImageMimeType(imageUrl: string | undefined | null): string | undefined {
  if (!imageUrl || typeof imageUrl !== 'string') return undefined;
  const cleanUrl = imageUrl.split('?')[0].split('#')[0].toLowerCase();
  if (cleanUrl.endsWith('.png')) return 'image/png';
  if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'image/jpeg';
  if (cleanUrl.endsWith('.webp')) return 'image/webp';
  if (cleanUrl.endsWith('.gif')) return 'image/gif';
  return undefined;
}

export function getVehicleSlug(vehicle: Vehicle): string {
  if (!vehicle) return '';
  const make = (vehicle.make || '').toLowerCase().trim();
  const model = (vehicle.model || '').toLowerCase().trim();
  const year = vehicle.year || '';
  const base = `${year}-${make}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || vehicle.id || 'car';
}

/**
 * Multi-pass prioritized vehicle lookup by exact ID, exact slug, or normalized ID/slug.
 * Never guesses an unrelated vehicle when the identifier does not match.
 */
export function findVehicleInList(vehicles: Vehicle[], identifier: string): Vehicle | undefined {
  if (!identifier || !Array.isArray(vehicles) || vehicles.length === 0) return undefined;
  const cleanId = decodeURIComponent(identifier)
    .toLowerCase()
    .trim()
    .replace(/^\/?(vehicles|car|v)\/?/, '')
    .replace(/\/+$/, '');
  if (!cleanId) return undefined;

  // Pass 1: Exact vehicle ID match
  const byExactId = vehicles.find((v) => v && (v.id || '').toLowerCase().trim() === cleanId);
  if (byExactId) return byExactId;

  // Pass 2: Exact generated slug match
  const byExactSlug = vehicles.find((v) => v && getVehicleSlug(v) === cleanId);
  if (byExactSlug) return byExactSlug;

  const cleanIdNoDash = cleanId.replace(/[^a-z0-9]/g, '');
  if (!cleanIdNoDash || cleanIdNoDash.length < 3) return undefined;

  // Pass 3: Exact alphanumeric vehicle ID match
  const byAlphaId = vehicles.find(
    (v) => v && (v.id || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanIdNoDash
  );
  if (byAlphaId) return byAlphaId;

  // Pass 4: Exact alphanumeric vehicle slug match
  const byAlphaSlug = vehicles.find(
    (v) => v && getVehicleSlug(v).replace(/[^a-z0-9]/g, '') === cleanIdNoDash
  );
  if (byAlphaSlug) return byAlphaSlug;

  // Pass 5: Prefix match where Firestore ID has a generated suffix (e.g., slug + "-" + suffix)
  const byPrefixId = vehicles.find((v) => {
    if (!v) return false;
    const vId = (v.id || '').toLowerCase().trim();
    const slug = getVehicleSlug(v);
    return (
      (vId.startsWith(`${cleanId}-`) && vId.length <= cleanId.length + 12) ||
      (slug && cleanId.startsWith(`${slug}-`) && cleanId.length <= slug.length + 12)
    );
  });
  return byPrefixId;
}

/**
 * Extracts a vehicle slug or ID from a URL or path if the request targets an individual vehicle page.
 */
export function extractVehicleIdentifierFromUrl(urlOrPath: string): string | null {
  if (!urlOrPath) return null;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlOrPath, DEFAULT_BASE_URL);
  } catch {
    parsedUrl = new URL(`/${urlOrPath.replace(/^\/+/, '')}`, DEFAULT_BASE_URL);
  }

  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  if (pathname.startsWith('/vehicles/')) {
    const id = pathname.replace(/^\/vehicles\/?/, '').replace(/\/+$/, '').trim();
    if (id) return decodeURIComponent(id);
  } else if (pathname.startsWith('/car/')) {
    const id = pathname.replace(/^\/car\/?/, '').replace(/\/+$/, '').trim();
    if (id) return decodeURIComponent(id);
  } else if (pathname.startsWith('/v/')) {
    const id = pathname.replace(/^\/v\/?/, '').replace(/\/+$/, '').trim();
    if (id) return decodeURIComponent(id);
  }

  const queryVehicle = searchParams.get('vehicle') || searchParams.get('v');
  if (queryVehicle && queryVehicle.trim()) {
    return queryVehicle.trim();
  }

  return null;
}

/**
 * Generates dynamic Open Graph and Twitter metadata for an individual vehicle listing.
 */
export function generateVehicleMetadata(
  vehicle: Vehicle,
  _baseUrl = DEFAULT_BASE_URL,
  requestUrl?: string,
  imageDimensions?: ImageDimensionsInfo
): PageMetadata {
  const cleanBase = DEFAULT_BASE_URL;
  const slug = getVehicleSlug(vehicle);

  const make = decodeUnicodeEscapes(vehicle.make || '').trim();
  const modelStr = decodeUnicodeEscapes(vehicle.model || '').trim();
  const trimCandidate = decodeUnicodeEscapes(((vehicle as any).trim || (vehicle as any).variant || '').toString()).trim();
  const modelWithTrim =
    trimCandidate && !modelStr.toLowerCase().includes(trimCandidate.toLowerCase())
      ? `${modelStr} ${trimCandidate}`.trim()
      : modelStr;
  const year = vehicle.year ? String(vehicle.year).trim() : '';

  // Dynamic vehicle title: [Vehicle Make] [Vehicle Model] [Year] | Jite Auto Deals
  const makeModelYear = [make, modelWithTrim, year].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const yearMakeModel = [year, make, modelWithTrim].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  const title = makeModelYear
    ? `${makeModelYear} | ${DEFAULT_SITE_NAME}`
    : `Vehicle Details | ${DEFAULT_SITE_NAME}`;

  // Build concise, factual description strictly from fields that exist on the vehicle record
  const specParts: string[] = [];

  const transmission = decodeUnicodeEscapes(vehicle.transmission || '').trim();
  if (transmission) {
    specParts.push(
      transmission.toLowerCase().includes('transmission') ? transmission : `${transmission} transmission`
    );
  }

  if (typeof vehicle.mileage === 'number' && !isNaN(vehicle.mileage) && vehicle.mileage > 0) {
    specParts.push(formatMileage(vehicle.mileage));
  }

  const condition = decodeUnicodeEscapes(vehicle.condition || '').trim();
  if (condition) {
    specParts.push(condition);
  }

  const fuelType = decodeUnicodeEscapes(vehicle.fuelType || '').trim();
  if (fuelType) {
    specParts.push(fuelType);
  }

  if (typeof vehicle.price === 'number' && !isNaN(vehicle.price) && vehicle.price > 0) {
    specParts.push(formatCurrency(vehicle.price));
  }

  const location = decodeUnicodeEscapes(vehicle.location || '').trim();
  if (location) {
    specParts.push(location);
  }

  const specsSentence = specParts.length > 0 ? `${specParts.join(', ')}. ` : '';
  const description = `${yearMakeModel ? `${yearMakeModel}. ` : ''}${specsSentence}View the full vehicle details on ${DEFAULT_SITE_NAME}.`;

  // Primary vehicle image with fallback to Jite Auto Deals brand banner if vehicle has no valid image
  const primaryVehicleImage = getPrimaryVehicleImage(vehicle);
  const isUsingBrandFallback = !primaryVehicleImage;
  const image = primaryVehicleImage || DEFAULT_BRAND_IMAGE;
  const imageSecureUrl = image.startsWith('https://') ? image : undefined;

  const imageType = isUsingBrandFallback
    ? DEFAULT_BRAND_IMAGE_TYPE
    : imageDimensions?.type || inferImageMimeType(image);
  const imageWidth = isUsingBrandFallback ? DEFAULT_BRAND_IMAGE_WIDTH : imageDimensions?.width;
  const imageHeight = isUsingBrandFallback ? DEFAULT_BRAND_IMAGE_HEIGHT : imageDimensions?.height;

  const imageAlt = yearMakeModel
    ? `${yearMakeModel} — ${DEFAULT_SITE_NAME}`
    : DEFAULT_BRAND_IMAGE_ALT;

  // Determine exact absolute production URL for this vehicle
  let vehiclePath = `/vehicles/${encodeURIComponent(slug)}`;
  if (requestUrl) {
    try {
      const parsed = new URL(requestUrl, cleanBase);
      if (parsed.pathname.startsWith('/vehicles/') && parsed.pathname.length > '/vehicles/'.length) {
        vehiclePath = parsed.pathname.replace(/\/+$/, '');
      }
    } catch {}
  }

  const canonicalUrl = `${cleanBase}${vehiclePath}`;

  const keywordParts = [
    yearMakeModel,
    make && modelWithTrim ? `buy ${make} ${modelWithTrim} Nigeria` : '',
    make && location ? `${make} for sale ${location}` : '',
    condition ? `${condition} cars Nigeria` : '',
    DEFAULT_SITE_NAME,
  ].filter(Boolean);

  return {
    title,
    description,
    image,
    imageSecureUrl,
    imageType,
    imageWidth,
    imageHeight,
    imageAlt,
    url: canonicalUrl,
    type: 'website',
    siteName: DEFAULT_SITE_NAME,
    locale: DEFAULT_LOCALE,
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image,
    twitterImageAlt: imageAlt,
    canonicalUrl,
    keywords: keywordParts.join(', '),
    vehicle,
  };
}

/**
 * Generates Open Graph and Twitter metadata for the homepage and public non-vehicle pages.
 */
export function generateTabMetadata(
  tab: string,
  _baseUrl = DEFAULT_BASE_URL,
  _requestUrl?: string
): PageMetadata {
  const cleanBase = DEFAULT_BASE_URL;
  const cleanTab = (tab || 'home').toLowerCase().replace(/^\/+/, '').replace(/\/+$/, '');

  const baseBrandImageFields = {
    image: DEFAULT_BRAND_IMAGE,
    imageSecureUrl: DEFAULT_BRAND_IMAGE,
    imageType: DEFAULT_BRAND_IMAGE_TYPE,
    imageWidth: DEFAULT_BRAND_IMAGE_WIDTH,
    imageHeight: DEFAULT_BRAND_IMAGE_HEIGHT,
    imageAlt: DEFAULT_BRAND_IMAGE_ALT,
    twitterImage: DEFAULT_BRAND_IMAGE,
    twitterImageAlt: DEFAULT_BRAND_IMAGE_ALT,
  };

  switch (cleanTab) {
    case 'browse':
    case 'inventory':
    case 'catalog':
    case 'cars': {
      const title = 'Verified Vehicle Catalog & Inventory | Jite Auto Deals';
      const description =
        'Browse inspected, duty-paid foreign used (Tokunbo) and verified Nigerian used vehicles in Lagos and Abuja. Sourced and vetted by Jite Auto Deals.';
      const canonicalUrl = `${cleanBase}/browse`;
      return {
        title,
        description,
        ...baseBrandImageFields,
        url: canonicalUrl,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        canonicalUrl,
        keywords:
          'buy car Nigeria, foreign used cars Lagos, Tokunbo cars Abuja, verified vehicle catalog, Toyota, Mercedes-Benz, Lexus, Jite Auto Deals',
      };
    }

    case 'find-car':
    case 'find-my-car': {
      const title = 'Find My Car | Custom Vehicle Specification Finder - Jite Auto Deals';
      const description =
        'Specify your exact vehicle brand, model, target budget, and condition. We source verified vehicles directly across Lagos and Abuja.';
      const canonicalUrl = `${cleanBase}/find-car`;
      return {
        title,
        description,
        ...baseBrandImageFields,
        url: canonicalUrl,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        canonicalUrl,
        keywords:
          'vehicle finder Nigeria, car sourcing request Lagos Abuja, custom vehicle inspection, Jite Auto Deals',
      };
    }

    case 'source-car':
    case 'source-a-car': {
      const title = 'Source a Car | External Listing Verification - Jite Auto Deals';
      const description =
        'Found a car online or at another dealership? Send us the link or details for complete verification, duty check, and physical pre-purchase inspection.';
      const canonicalUrl = `${cleanBase}/source-car`;
      return {
        title,
        description,
        ...baseBrandImageFields,
        url: canonicalUrl,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        canonicalUrl,
        keywords:
          'car verification Nigeria, pre-purchase car inspection Lagos, customs duty verification, Tobor Jite, Jite Auto Deals',
      };
    }

    case 'how-it-works': {
      const title = 'How It Works & Vehicle Finance | Jite Auto Deals';
      const description =
        'Learn how our personalized vehicle sourcing, pre-purchase inspection, and auto finance partnership programs work in Nigeria.';
      const canonicalUrl = `${cleanBase}/how-it-works`;
      return {
        title,
        description,
        ...baseBrandImageFields,
        url: canonicalUrl,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        canonicalUrl,
        keywords: 'car financing Nigeria, vehicle purchase process, car inspection steps, Jite Auto Deals',
      };
    }

    case 'about': {
      const title = 'About Tobor Jite | Jite Auto Deals - Vehicle Consultant';
      const description =
        'Meet Tobor Jite, dedicated vehicle consultant and sourcing specialist in Nigeria helping individuals and corporate clients buy quality cars with total confidence.';
      const canonicalUrl = `${cleanBase}/about`;
      return {
        title,
        description,
        ...baseBrandImageFields,
        url: canonicalUrl,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        canonicalUrl,
        keywords:
          'Tobor Jite, vehicle consultant Nigeria, automotive sourcing consultant Lagos Abuja, Jite Auto Deals founder',
      };
    }

    case 'admin': {
      const title = 'Admin Portal | Jite Auto Deals';
      const description =
        'Secure administration management portal for Jite Auto Deals inventory, leads, and inquiries.';
      const canonicalUrl = `${cleanBase}/admin`;
      return {
        title,
        description,
        ...baseBrandImageFields,
        url: canonicalUrl,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        canonicalUrl,
      };
    }

    case 'home':
    default: {
      const title = 'Jite Auto Deals | Trusted Vehicle Consultant';
      const description =
        'Buying a car in Nigeria shouldn’t feel like a gamble. Avoid untrusted sellers, hidden faults and costly mistakes. Jite Auto Deals helps you find, source and choose the right vehicle with greater confidence.';
      const canonicalUrl = `${cleanBase}/`;
      return {
        title,
        description,
        ...baseBrandImageFields,
        url: canonicalUrl,
        type: 'website',
        siteName: DEFAULT_SITE_NAME,
        locale: DEFAULT_LOCALE,
        twitterCard: 'summary_large_image',
        twitterTitle: title,
        twitterDescription: description,
        canonicalUrl,
        keywords:
          'Jite Auto Deals, vehicle consultant Nigeria, car dealer Lagos, car dealer Abuja, buy foreign used cars Nigeria, buy Tokunbo cars, Toyota, Mercedes-Benz, Lexus, Honda, vehicle inspection Nigeria',
      };
    }
  }
}

/**
 * Universal route resolver that parses URL path and queries and finds the matching page or vehicle.
 */
export function resolveRouteMetadata(
  urlOrPath: string,
  vehicles: Vehicle[],
  _customBaseUrl?: string,
  imageDimensions?: ImageDimensionsInfo
): PageMetadata {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlOrPath, DEFAULT_BASE_URL);
  } catch {
    parsedUrl = new URL(`/${(urlOrPath || '').replace(/^\/+/, '')}`, DEFAULT_BASE_URL);
  }

  const vehicleIdentifier = extractVehicleIdentifierFromUrl(parsedUrl.toString());
  if (vehicleIdentifier) {
    const matched = findVehicleInList(vehicles, vehicleIdentifier);
    if (matched) {
      return generateVehicleMetadata(matched, DEFAULT_BASE_URL, parsedUrl.toString(), imageDimensions);
    }
    // If vehicle cannot be resolved, do not generate misleading vehicle metadata
    return generateTabMetadata('home', DEFAULT_BASE_URL);
  }

  const searchParams = parsedUrl.searchParams;
  const tabQuery = searchParams.get('tab');
  if (tabQuery) {
    return generateTabMetadata(tabQuery, DEFAULT_BASE_URL, parsedUrl.toString());
  }

  const cleanPath = parsedUrl.pathname.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
  if (cleanPath) {
    return generateTabMetadata(cleanPath, DEFAULT_BASE_URL, parsedUrl.toString());
  }

  return generateTabMetadata('home', DEFAULT_BASE_URL, parsedUrl.toString());
}

// ============================================================================
// SERVER-SIDE FIRESTORE REST & IMAGE DIMENSION PROBING HELPERS
// ============================================================================

let firestoreVehiclesCache: Vehicle[] | null = null;
let firestoreVehiclesCacheTime = 0;
const FIRESTORE_CACHE_TTL_MS = 15 * 1000; // 15 seconds

const imageDimensionsCache = new Map<string, ImageDimensionsInfo>([
  [
    DEFAULT_BRAND_IMAGE,
    {
      width: DEFAULT_BRAND_IMAGE_WIDTH,
      height: DEFAULT_BRAND_IMAGE_HEIGHT,
      type: DEFAULT_BRAND_IMAGE_TYPE,
    },
  ],
]);

export function parseFirestoreRestDocument(docObj: any): Vehicle | null {
  if (!docObj || !docObj.fields) return null;
  const f = docObj.fields;
  const docName = typeof docObj.name === 'string' ? docObj.name : '';
  const docIdFromPath = docName.split('/').pop() || '';

  const getStr = (key: string, fallback = ''): string => {
    const val = f[key]?.stringValue;
    return typeof val === 'string' ? decodeUnicodeEscapes(val) : fallback;
  };

  const getNum = (key: string, fallback = 0): number => {
    if (f[key]?.integerValue !== undefined) return Number(f[key].integerValue) || fallback;
    if (f[key]?.doubleValue !== undefined) return Number(f[key].doubleValue) || fallback;
    if (f[key]?.stringValue !== undefined) return Number(f[key].stringValue) || fallback;
    return fallback;
  };

  const getBool = (key: string, fallback = false): boolean => {
    if (typeof f[key]?.booleanValue === 'boolean') return f[key].booleanValue;
    return fallback;
  };

  const images: string[] = [];
  const rawValues = f.images?.arrayValue?.values;
  if (Array.isArray(rawValues)) {
    for (const item of rawValues) {
      if (typeof item?.stringValue === 'string' && item.stringValue.trim()) {
        images.push(item.stringValue.trim());
      }
    }
  }

  const id = getStr('id') || docIdFromPath;
  const make = getStr('make');
  const model = getStr('model');
  if (!id && !make && !model) return null;

  const mileageVal = getNum('mileage', 0);

  return {
    id,
    make,
    model,
    year: getNum('year', 2020),
    price: getNum('price', 0),
    mileage: mileageVal > 0 ? mileageVal : undefined,
    transmission: getStr('transmission', ''),
    fuelType: getStr('fuelType', ''),
    bodyType: getStr('bodyType', ''),
    location: getStr('location', ''),
    dealership: getStr('dealership', ''),
    images,
    description: getStr('description', ''),
    engine: getStr('engine', ''),
    color: getStr('color', ''),
    condition: getStr('condition', ''),
    isFeatured: getBool('isFeatured', true),
    inSlideshow: getBool('inSlideshow', false),
    slideshowOrder: getNum('slideshowOrder', 0),
    status: (getStr('status', 'Active') as any) || 'Active',
    createdAt: getStr('createdAt', ''),
    updatedAt: getStr('updatedAt', ''),
  };
}

export async function fetchVehicleByIdFromFirestoreRest(docId: string): Promise<Vehicle | null> {
  if (!docId) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/vehicles/${encodeURIComponent(docId)}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    return parseFirestoreRestDocument(data);
  } catch {
    return null;
  }
}

export async function fetchAllVehiclesFromFirestoreRest(): Promise<Vehicle[]> {
  const now = Date.now();
  if (firestoreVehiclesCache && now - firestoreVehiclesCacheTime < FIRESTORE_CACHE_TTL_MS) {
    return firestoreVehiclesCache;
  }

  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents:runQuery`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'vehicles' }],
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return firestoreVehiclesCache || [];

    const rows = await res.json();
    if (!Array.isArray(rows)) return firestoreVehiclesCache || [];

    const vehicles: Vehicle[] = [];
    for (const row of rows) {
      if (row && row.document) {
        const parsed = parseFirestoreRestDocument(row.document);
        if (parsed) vehicles.push(parsed);
      }
    }

    if (vehicles.length > 0) {
      firestoreVehiclesCache = vehicles;
      firestoreVehiclesCacheTime = now;
    }
    return vehicles;
  } catch {
    return firestoreVehiclesCache || [];
  }
}

/**
 * Probes an image URL via HTTP HEAD to obtain real Content-Type and real dimensions
 * (e.g. from Cloudinary server-timing headers) without fabricating values.
 */
export async function probeImageMetadata(imageUrl: string): Promise<ImageDimensionsInfo> {
  if (!imageUrl || !imageUrl.startsWith('http')) return {};
  const cached = imageDimensionsCache.get(imageUrl);
  if (cached) return cached;

  const info: ImageDimensionsInfo = {
    type: inferImageMimeType(imageUrl),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(imageUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.startsWith('image/')) {
        info.type = contentType.split(';')[0].trim();
      }
      const serverTiming = res.headers.get('server-timing') || '';
      const widthMatch = serverTiming.match(/\bwidth=(\d+)/i);
      const heightMatch = serverTiming.match(/\bheight=(\d+)/i);
      if (widthMatch && heightMatch) {
        const w = parseInt(widthMatch[1], 10);
        const h = parseInt(heightMatch[1], 10);
        if (w > 0 && h > 0) {
          info.width = w;
          info.height = h;
        }
      }
    }
  } catch {
    // Keep inferred type if HEAD times out
  }

  imageDimensionsCache.set(imageUrl, info);
  return info;
}

/**
 * Server-side route metadata resolver that queries live Cloud Firestore (with local store fallback)
 * and resolves real Open Graph image metadata for individual vehicle pages.
 */
export async function resolveServerRouteMetadata(
  urlOrPath: string,
  fallbackVehicles: Vehicle[] = []
): Promise<PageMetadata> {
  const vehicleIdentifier = extractVehicleIdentifierFromUrl(urlOrPath);

  if (vehicleIdentifier) {
    const cleanId = decodeURIComponent(vehicleIdentifier)
      .toLowerCase()
      .trim()
      .replace(/^\/?(vehicles|car|v)\/?/, '')
      .replace(/\/+$/, '');

    // 1. Try direct Firestore document lookup by ID first
    let matched: Vehicle | undefined | null = await fetchVehicleByIdFromFirestoreRest(cleanId);

    // 2. If not found by exact document ID, query live Firestore catalog + merge fallback vehicles
    if (!matched) {
      const liveVehicles = await fetchAllVehiclesFromFirestoreRest();
      const mergedMap = new Map<string, Vehicle>();
      for (const v of fallbackVehicles) {
        if (v && v.id) mergedMap.set(v.id, v);
      }
      for (const v of liveVehicles) {
        if (v && v.id) mergedMap.set(v.id, v);
      }
      const combined = Array.from(mergedMap.values());
      matched = findVehicleInList(combined, cleanId);
    }

    if (matched) {
      const primaryImg = getPrimaryVehicleImage(matched) || DEFAULT_BRAND_IMAGE;
      const imgDimensions = await probeImageMetadata(primaryImg);
      return generateVehicleMetadata(matched, DEFAULT_BASE_URL, urlOrPath, imgDimensions);
    }

    // Vehicle could not be resolved -> fall back to homepage metadata without misleading vehicle tags
    return generateTabMetadata('home', DEFAULT_BASE_URL);
  }

  return resolveRouteMetadata(urlOrPath, fallbackVehicles, DEFAULT_BASE_URL);
}

/**
 * Injects Open Graph, Twitter, and canonical metadata tags cleanly into the HTML head,
 * eliminating duplicates or stale tags.
 */
export function injectMetadataIntoHtml(html: string, meta: PageMetadata): string {
  if (!html) return html;

  const escapeAttr = (str: string | undefined | null) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  const safeTitle = escapeAttr(meta.title);
  const safeDesc = escapeAttr(meta.description);
  const safeImage = escapeAttr(meta.image);
  const safeImageSecure = escapeAttr(meta.imageSecureUrl || (meta.image.startsWith('https://') ? meta.image : ''));
  const safeImageType = meta.imageType ? escapeAttr(meta.imageType) : '';
  const safeImageAlt = escapeAttr(meta.imageAlt || meta.title);
  const safeUrl = escapeAttr(meta.url);
  const safeCanonical = escapeAttr(meta.canonicalUrl || meta.url);
  const safeSiteName = escapeAttr(meta.siteName || DEFAULT_SITE_NAME);
  const safeLocale = escapeAttr(meta.locale || DEFAULT_LOCALE);
  const safeKeywords = meta.keywords ? escapeAttr(meta.keywords) : '';
  const safeTwitterTitle = escapeAttr(meta.twitterTitle || meta.title);
  const safeTwitterDesc = escapeAttr(meta.twitterDescription || meta.description);
  const safeTwitterImage = escapeAttr(meta.twitterImage || meta.image);
  const safeTwitterImageAlt = escapeAttr(meta.twitterImageAlt || meta.imageAlt || meta.title);

  const ogImageExtraTags = [
    safeImageSecure ? `<meta property="og:image:secure_url" content="${safeImageSecure}" />` : '',
    safeImageType ? `<meta property="og:image:type" content="${safeImageType}" />` : '',
    meta.imageWidth && meta.imageWidth > 0 ? `<meta property="og:image:width" content="${meta.imageWidth}" />` : '',
    meta.imageHeight && meta.imageHeight > 0 ? `<meta property="og:image:height" content="${meta.imageHeight}" />` : '',
    `<meta property="og:image:alt" content="${safeImageAlt}" />`,
  ]
    .filter(Boolean)
    .join('\n    ');

  const newMetaBlock = `
    <!-- Primary SEO Meta Tags -->
    <title>${safeTitle}</title>
    <meta name="title" content="${safeTitle}" />
    <meta name="description" content="${safeDesc}" />
    ${safeKeywords ? `<meta name="keywords" content="${safeKeywords}" />` : ''}
    <link rel="canonical" href="${safeCanonical}" />

    <!-- Open Graph / Facebook / WhatsApp / LinkedIn / Telegram -->
    <meta property="og:type" content="${meta.type || 'website'}" />
    <meta property="og:site_name" content="${safeSiteName}" />
    <meta property="og:locale" content="${safeLocale}" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:image" content="${safeImage}" />
    ${ogImageExtraTags}

    <!-- Twitter / X -->
    <meta name="twitter:card" content="${meta.twitterCard || 'summary_large_image'}" />
    <meta name="twitter:url" content="${safeUrl}" />
    <meta name="twitter:title" content="${safeTwitterTitle}" />
    <meta name="twitter:description" content="${safeTwitterDesc}" />
    <meta name="twitter:image" content="${safeTwitterImage}" />
    <meta name="twitter:image:alt" content="${safeTwitterImageAlt}" />`;

  // Remove existing title, canonical, and conflicting og/twitter tags in the HTML
  const cleaned = html
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+name=["']title["'][\s\S]*?>/gi, '')
    .replace(/<meta\s+name=["']description["'][\s\S]*?>/gi, '')
    .replace(/<meta\s+name=["']keywords["'][\s\S]*?>/gi, '')
    .replace(/<meta\s+property=["']og:[^"']+["'][\s\S]*?>/gi, '')
    .replace(/<meta\s+name=["']twitter:[^"']+["'][\s\S]*?>/gi, '')
    .replace(/<link\s+rel=["']canonical["'][\s\S]*?>/gi, '');

  if (cleaned.includes('<head>')) {
    return cleaned.replace('<head>', `<head>${newMetaBlock}`);
  }
  if (cleaned.includes('<head ')) {
    return cleaned.replace(/<head[^>]*>/, `$&${newMetaBlock}`);
  }
  if (cleaned.includes('</head>')) {
    return cleaned.replace('</head>', `${newMetaBlock}\n  </head>`);
  }

  return `${newMetaBlock}\n${cleaned}`;
}

/**
 * Synchronizes client-side DOM meta tags when navigating dynamically in the browser SPA.
 */
export function updateClientMeta(meta: PageMetadata): void {
  if (typeof document === 'undefined') return;

  document.title = meta.title;

  const setOrCreateMeta = (selector: string, attrName: string, attrValue: string, content: string) => {
    let el = document.querySelector(selector) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  const removeMeta = (selector: string) => {
    const el = document.querySelector(selector);
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  };

  // Standard Meta Tags
  setOrCreateMeta('meta[name="title"]', 'name', 'title', meta.title);
  setOrCreateMeta('meta[name="description"]', 'name', 'description', meta.description);

  // Open Graph Tags
  setOrCreateMeta('meta[property="og:title"]', 'property', 'og:title', meta.title);
  setOrCreateMeta('meta[property="og:description"]', 'property', 'og:description', meta.description);
  setOrCreateMeta('meta[property="og:image"]', 'property', 'og:image', meta.image);
  if (meta.imageSecureUrl || meta.image.startsWith('https://')) {
    setOrCreateMeta(
      'meta[property="og:image:secure_url"]',
      'property',
      'og:image:secure_url',
      meta.imageSecureUrl || meta.image
    );
  } else {
    removeMeta('meta[property="og:image:secure_url"]');
  }

  if (meta.imageType) {
    setOrCreateMeta('meta[property="og:image:type"]', 'property', 'og:image:type', meta.imageType);
  } else {
    removeMeta('meta[property="og:image:type"]');
  }

  if (meta.imageWidth && meta.imageWidth > 0) {
    setOrCreateMeta('meta[property="og:image:width"]', 'property', 'og:image:width', String(meta.imageWidth));
  } else {
    removeMeta('meta[property="og:image:width"]');
  }

  if (meta.imageHeight && meta.imageHeight > 0) {
    setOrCreateMeta('meta[property="og:image:height"]', 'property', 'og:image:height', String(meta.imageHeight));
  } else {
    removeMeta('meta[property="og:image:height"]');
  }

  setOrCreateMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', meta.imageAlt || meta.title);
  setOrCreateMeta('meta[property="og:url"]', 'property', 'og:url', meta.url);
  setOrCreateMeta('meta[property="og:type"]', 'property', 'og:type', meta.type || 'website');
  setOrCreateMeta('meta[property="og:site_name"]', 'property', 'og:site_name', meta.siteName || DEFAULT_SITE_NAME);
  setOrCreateMeta('meta[property="og:locale"]', 'property', 'og:locale', meta.locale || DEFAULT_LOCALE);

  // Twitter Tags
  setOrCreateMeta('meta[name="twitter:card"]', 'name', 'twitter:card', meta.twitterCard || 'summary_large_image');
  setOrCreateMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.twitterTitle || meta.title);
  setOrCreateMeta(
    'meta[name="twitter:description"]',
    'name',
    'twitter:description',
    meta.twitterDescription || meta.description
  );
  setOrCreateMeta('meta[name="twitter:image"]', 'name', 'twitter:image', meta.twitterImage || meta.image);
  setOrCreateMeta(
    'meta[name="twitter:image:alt"]',
    'name',
    'twitter:image:alt',
    meta.twitterImageAlt || meta.imageAlt || meta.title
  );
  setOrCreateMeta('meta[name="twitter:url"]', 'name', 'twitter:url', meta.url);

  // Canonical Link
  let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', meta.canonicalUrl || meta.url);
}
