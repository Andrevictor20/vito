import { useState } from 'react';
import { Alert } from 'react-native';

let ImagePicker: typeof import('expo-image-picker') | null = null;
try {
  ImagePicker = require('expo-image-picker');
} catch {
  ImagePicker = null;
}

export function useChatImagePicker(loading: boolean) {
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string | null>(null);

  const clearSelectedImage = () => {
    setSelectedImageUri(null);
    setSelectedImageBase64(null);
    setSelectedImageMime(null);
  };

  const openImagePicker = async (useCamera: boolean = false) => {
    if (loading) return;
    if (!ImagePicker) {
      Alert.alert('Fotos', 'Módulo de fotos não disponível nesta versão.');
      return;
    }

    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          useCamera ? 'Permissão da Câmera' : 'Permissão de Fotos',
          useCamera
            ? 'É necessário conceder permissão de câmera para tirar foto de convites e recibos.'
            : 'É necessário conceder permissão de galeria para anexar imagens.'
        );
        return;
      }

      const opts = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      };
      const result = useCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedImageUri(result.assets[0].uri);
        setSelectedImageBase64(result.assets[0].base64 || null);
        setSelectedImageMime(result.assets[0].mimeType || null);
      }
    } catch (e) {
      console.error('Falha ao selecionar imagem:', e);
      Alert.alert('Erro', 'Não foi possível carregar a imagem.');
    }
  };

  const handlePickImage = () => {
    if (loading) return;
    Alert.alert('Anexar Imagem', 'Como deseja enviar a foto ou documento para o Vito?', [
      { text: 'Tirar Foto', onPress: () => openImagePicker(true) },
      { text: 'Escolher da Galeria', onPress: () => openImagePicker(false) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return {
    selectedImageUri,
    selectedImageBase64,
    selectedImageMime,
    clearSelectedImage,
    handlePickImage,
  };
}
