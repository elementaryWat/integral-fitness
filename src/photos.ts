import { Alert } from 'react-native';
import { DocumentDirectoryPath, copyFile, mkdir, readFile, unlink } from '@dr.pogodin/react-native-fs';
import { launchCamera, launchImageLibrary, type ImagePickerResponse } from 'react-native-image-picker';
import { uid } from './domain/dates';
import type { ProgressPhoto } from './domain/types';

const DIR = `${DocumentDirectoryPath}/photos`;

/**
 * Photos are stored by file name only: the app container path changes between installs/updates
 * on iOS, so the absolute path is resolved at render time.
 */
export const photoUri = (p: ProgressPhoto) => (p.uri.includes('/') ? p.uri : `file://${DIR}/${p.uri}`);

async function persist(res: ImagePickerResponse): Promise<string | undefined> {
  const asset = res.assets?.[0];
  if (res.didCancel || !asset?.uri) return undefined;
  const name = `${uid()}.${asset.fileName?.split('.').pop() ?? 'jpg'}`;
  await mkdir(DIR);
  await copyFile(asset.uri.replace('file://', ''), `${DIR}/${name}`);
  return name;
}

/** Ask camera vs. library, copy the picked image into the app's documents and return its file name. */
export function pickPhoto(): Promise<string | undefined> {
  const opts = { mediaType: 'photo' as const, quality: 0.8 as const, maxWidth: 1600, maxHeight: 1600 };
  return new Promise((resolve) => {
    Alert.alert('Foto de progreso', 'Misma luz, distancia y postura cada semana.', [
      { text: 'Cámara', onPress: () => launchCamera({ ...opts, saveToPhotos: false }).then(persist).then(resolve, () => resolve(undefined)) },
      { text: 'Carrete', onPress: () => launchImageLibrary({ ...opts, selectionLimit: 1 }).then(persist).then(resolve, () => resolve(undefined)) },
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(undefined) },
    ]);
  });
}

export async function deletePhotoFile(p: ProgressPhoto) {
  if (p.uri.includes('/')) return;
  try { await unlink(`${DIR}/${p.uri}`); } catch { /* already gone */ }
}

/** iOS reports JPEGs as `image/jpg`; the vision API (and our server) expect `image/jpeg`. Resized picks are always re-encoded as JPEG. */
export function normalizeMime(type?: string) {
  const t = (type ?? '').toLowerCase();
  if (t === 'image/png') return 'image/png';
  if (t === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

const AI_OPTS = { mediaType: 'photo' as const, quality: 0.7 as const, maxWidth: 1280, maxHeight: 1280, includeBase64: true };

function assetDataUrl(res: ImagePickerResponse): { dataUrl: string; uri: string } | undefined {
  const asset = res.assets?.[0];
  if (res.didCancel || !asset?.uri || !asset.base64) return undefined;
  return { dataUrl: `data:${normalizeMime(asset.type)};base64,${asset.base64.replace(/\s+/g, '')}`, uri: asset.uri };
}

/** Camera or library, sized for the vision model. The image is not stored. */
export function pickImageForAi(title: string): Promise<{ dataUrl: string; uri: string } | undefined> {
  return new Promise((resolve) => {
    Alert.alert(title, 'La imagen se envía a la IA y no se guarda.', [
      { text: 'Cámara', onPress: () => launchCamera({ ...AI_OPTS, saveToPhotos: false }).then(assetDataUrl).then(resolve, () => resolve(undefined)) },
      { text: 'Carrete', onPress: () => launchImageLibrary({ ...AI_OPTS, selectionLimit: 1 }).then(assetDataUrl).then(resolve, () => resolve(undefined)) },
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(undefined) },
    ]);
  });
}

const mimeFor = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
};

/** Read a stored progress photo and return a data URL the coach request can attach. */
export async function photoDataUrl(p: ProgressPhoto): Promise<string> {
  const path = (p.uri.includes('/') ? p.uri : `${DIR}/${p.uri}`).replace(/^file:\/\//, '');
  const b64 = await readFile(path, 'base64');
  return `data:${mimeFor(path)};base64,${b64.replace(/\s+/g, '')}`;
}
