import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/** One page of a receipt, ready to send: a compressed photo or a PDF */
export type ReceiptFile = { base64: string; mimeType: string; uri: string; kind: 'image' | 'pdf'; name?: string };

/** Longest side after resizing: sharp enough for receipt text, small enough to upload quickly */
const MAX_SIDE = 1800;
/** Photos of one long receipt, sent together */
export const MAX_PAGES = 6;
const MAX_PDF_BYTES = 8 * 1024 * 1024;

const stripPrefix = (b64: string) => b64.replace(/^data:[^;]+;base64,/, '');

async function compress(asset: ImagePicker.ImagePickerAsset): Promise<ReceiptFile> {
  const w = asset.width || MAX_SIDE;
  const h = asset.height || MAX_SIDE;
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (Math.max(w, h) > MAX_SIDE) ctx.resize(w >= h ? { width: MAX_SIDE } : { height: MAX_SIDE });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.72, base64: true });
  if (!saved.base64) throw new Error('ما قدرنا نجهّز الصورة، جرّب مرة ثانية.');
  return { base64: stripPrefix(saved.base64), mimeType: 'image/jpeg', uri: saved.uri, kind: 'image' };
}

/**
 * Takes one photo with the camera, or picks up to `limit` photos from the library (parts of one long receipt,
 * in the order chosen). Returns [] if the person cancels; throws with a readable message if permission is refused.
 */
export async function pickReceiptPhotos(source: 'camera' | 'library', limit = MAX_PAGES): Promise<ReceiptFile[]> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('اسمح للتطبيق باستخدام الكاميرا من إعدادات الجوال، أو اختر صورة من المعرض.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false });
    if (result.canceled || !result.assets?.length) return [];
    return [await compress(result.assets[0])];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsMultipleSelection: limit > 1,
    selectionLimit: Math.max(1, limit),
    orderedSelection: true,
  });
  if (result.canceled || !result.assets?.length) return [];
  const out: ReceiptFile[] = [];
  for (const a of result.assets.slice(0, limit)) out.push(await compress(a));
  return out;
}

/** Picks a PDF receipt (an e-receipt, or a scanned long receipt). Returns null if the person cancels. */
export async function pickReceiptPdf(): Promise<ReceiptFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: false, copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  const a = result.assets[0];
  if (a.size && a.size > MAX_PDF_BYTES) throw new Error('ملف الـPDF كبير (أكثر من 8 ميغا). جرّب ملف أصغر أو صوّر الفاتورة.');
  let base64 = a.base64 ? stripPrefix(a.base64) : '';
  if (!base64 && Platform.OS !== 'web') {
    const file = new File(a.uri);
    if (file.size > MAX_PDF_BYTES) throw new Error('ملف الـPDF كبير (أكثر من 8 ميغا). جرّب ملف أصغر أو صوّر الفاتورة.');
    base64 = await file.base64();
  }
  if (!base64) throw new Error('ما قدرنا نفتح الملف، جرّب مرة ثانية.');
  return { base64, mimeType: 'application/pdf', uri: a.uri, kind: 'pdf', name: a.name };
}
