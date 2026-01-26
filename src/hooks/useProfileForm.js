import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateProfile } from '../store/slices/authSlice';
import { uploadProfileImage } from '../api/auth';

export default function useProfileForm() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const fileInputRef = useRef(null);
  
  const [form, setForm] = useState({ name: '' });
  const [profileImage, setProfileImage] = useState(null);
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || '' });
      setProfileImage(user.profileImage || null);
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('JPG, PNG, WebP 형식만 업로드 가능합니다');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('파일 크기는 5MB 이하여야 합니다');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const newPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(newPreviewUrl);
    setPendingImageFile(file);
    setRemoveImage(false);
    setError(null);
  };

  const handleRemoveImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPendingImageFile(null);
    setRemoveImage(true);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) {
      setError('이름을 입력해주세요');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      let newImageUrl = profileImage;

      if (removeImage) {
        newImageUrl = '';
      } else if (pendingImageFile) {
        setUploading(true);
        newImageUrl = await uploadProfileImage(pendingImageFile);
        setUploading(false);
      }

      const updateData = { ...form };
      if (removeImage || pendingImageFile) {
        updateData.profileImage = newImageUrl;
      }

      await dispatch(updateProfile(updateData)).unwrap();
      
      setProfileImage(newImageUrl || null);
      setPendingImageFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setRemoveImage(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Profile update failed:', err);
      setError('프로필 업데이트에 실패했습니다');
      setUploading(false);
    }
    setLoading(false);
  };

  const displayImage = removeImage ? null : (previewUrl || profileImage);
  const hasChanges = pendingImageFile || removeImage || form.name !== (user?.name || '');

  return {
    user,
    form,
    setForm,
    displayImage,
    hasChanges,
    uploading,
    loading,
    success,
    error,
    pendingImageFile,
    fileInputRef,
    handleImageChange,
    handleRemoveImage,
    handleSubmit,
    setSuccess,
    setError,
  };
}
