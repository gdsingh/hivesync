export interface FoursquareSticker {
  id: string;
  name: string;
  image: { prefix: string; name: string };
  group?: { name: string };
  unlockText?: string;
  teaseText?: string;
}
