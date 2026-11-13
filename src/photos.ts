import { Alert } from 'react-native';
import { DocumentDirectoryPath, copyFile, mkdir, unlink } from '@dr.pogodin/react-native-fs';
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
