// Static catalog for the "Shop the Look" gallery. Images live in
// public/garments/ and are served as-is by Next's static file handling.
// Add a garment by dropping an image there and adding an entry here.
export type Garment = {
  id: string;
  name: string;
  src: string;
};

export const GARMENTS: Garment[] = [
  { id: "straw-hat", name: "Straw Sun Hat", src: "/garments/straw-hat.jpg" },
  { id: "awet-tee", name: "ÁWET Logo Tee", src: "/garments/awet-tee.jpg" },
  {
    id: "mustard-sweater",
    name: "Mustard Knit Sweater",
    src: "/garments/mustard-sweater.jpg",
  },
];
