type PhotoUploadPlaceholderProps = {
  label?: string;
};

export function PhotoUploadPlaceholder({ label = 'Photo placeholder' }: PhotoUploadPlaceholderProps) {
  return (
    <div className="photo-upload-placeholder" role="img" aria-label={label}>
      <span className="photo-upload-placeholder__icon">📷</span>
      <p className="photo-upload-placeholder__label">{label}</p>
    </div>
  );
}
