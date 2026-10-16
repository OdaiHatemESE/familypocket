import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type ReceiptPhoto = { base64: string; mimeType: string; uri: string };

/** Longest side after resizing: sharp enough for receipt text, small enough to upload quickly */
const MAX_SIDE = 1800;

/**
 * Opens the camera or the photo library and returns a compressed JPEG ready to send.
 * Returns null if the person cancels; throws with a readable message if permission is refused.
 */
export async function pickReceiptPhoto(source: 'camera' | 'library'): Promise<ReceiptPhoto | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('اسمح للتطبيق باستخدام الكاميرا من إعدادات الجوال، أو اختر صورة من المعرض.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const w = asset.width || MAX_SIDE;
  const h = asset.height || MAX_SIDE;
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (Math.max(w, h) > MAX_SIDE) ctx.resize(w >= h ? { width: MAX_SIDE } : { height: MAX_SIDE });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.72, base64: true });
  if (!saved.base64) throw new Error('ما قدرنا نجهّز الصورة، جرّب مرة ثانية.');
  return { base64: saved.base64.replace(/^data:[^;]+;base64,/, ''), mimeType: 'image/jpeg', uri: saved.uri };
}
