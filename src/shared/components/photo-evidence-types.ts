export type PhotoUploadPlaceholderProps = {
  label?: string;
};

export type GeoState = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
};

export type UploadState = 'idle' | 'processing' | 'uploading' | 'saved' | 'error';
