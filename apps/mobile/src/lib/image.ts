import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** Longest edge the vision model uses at full detail. */
const MAX_EDGE = 1568;

/**
 * Take (or pick) a photo of the commanders, downscaled and JPEG-encoded.
 * Returns raw base64, or null if the user cancelled.
 */
export async function pickPodPhoto(source: "camera" | "library" = "camera"): Promise<string | null> {
  let result: ImagePicker.ImagePickerResult;
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("Camera permission is needed to snap the commanders.");
    result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
  } else {
    result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  }
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const landscape = asset.width >= asset.height;
  const longEdge = Math.max(asset.width, asset.height);
  const context = ImageManipulator.manipulate(asset.uri);
  if (longEdge > MAX_EDGE) {
    context.resize(landscape ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.75, base64: true });
  if (!saved.base64) throw new Error("Couldn't process the photo.");
  return saved.base64;
}
