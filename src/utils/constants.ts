export type Combo = {
  id: number;
  name: string;
  description: string;
  price: number;
  hasSide: boolean;
  sideOptions?: string[];
  debonable?: boolean;
  image?: string;
};
export type Extra = { id:string; label:string; price:number, image?: string }

export const COMBOS: Combo[] = [
  {
    id: 1,
    name: "Combo 1",
    description: "1 Pollo  + Guarnición + 2 postrecitos de la casa",
    price: 25000,
    hasSide: true,
    sideOptions: [
      "Ensalada mixta",
      "Papa al horno",
      "Papa,calabaza y batata",
    ],
    image: "/media/combo1.png",
  },
  {
    id: 2,
    name: "Combo 2",
    description: "2 Pollos  + Guarnición + 4 postrecitos de la casa",
    price: 35000,
    hasSide: true,
    sideOptions: [
      "Ensalada mixta",
      "Papa al horno",
      "Papa,calabaza y batata",
    ],
    image: "/media/combo2.png",
  },
  {
    id: 3,
    name: "Menú Infantil",
    description: "Hamburguesa con queso y papas fritas",
    price: 5000,
    hasSide: false,
    image: "/media/comboinfantil.png",
  },
];

export const SIDES = [
  "Ensalada de lechuga, tomate y zanahoria",
  "Papa al horno",
  "Papa con calabaza y batata",
];

export const EXTRAS: Extra[] = [
  { id:'cuarto', label:' Presa de pollo extra', price:6500, image: '/media/presa.png' },
  { id:'postre', label:'Postrecito de la casa extra', price:2000, image: '/media/gelatina.png' },
  { id:'deshuesado', label:'Servicio de deshuesado', price:3500, image: '/media/deshuesado.png' },
]

export const WHATSAPP_NUMBER = '+5491130623998'

export function isExtra(product: Combo | Extra): product is Extra {
  return (product as Extra).label !== undefined;
}
