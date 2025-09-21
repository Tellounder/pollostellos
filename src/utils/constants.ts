export type Combo = {
  id: number;
  name: string;
  description: string;
  price: number;
  hasSide: boolean;
  sideOptions?: string[];
  debonable?: boolean;
};
export type Extra = { id:string; label:string; price:number }

export const COMBOS: Combo[] = [
  {
    id: 1,
    name: "Combo 1",
    description: "Pollo entero + Guarnición + 2 postrecitos de la casa",
    price: 24000,
    hasSide: true,
    sideOptions: [
      "Ensalada de lechuga, tomate y zanahoria",
      "Papa al horno",
      "Papa con calabaza y batata",
    ],
  },
  {
    id: 2,
    name: "Combo 2",
    description: "2 pollos enteros + Guarnición + 4 postrecitos de la casa",
    price: 35000,
    hasSide: true,
    sideOptions: [
      "Ensalada de lechuga, tomate y zanahoria",
      "Papa al horno",
      "Papa con calabaza y batata",
    ],
  },
  {
    id: 3,
    name: "Menú Infantil",
    description: "Hamburguesa con queso y papas fritas",
    price: 5000,
    hasSide: false,
  },
];

export const SIDES = [
  "Ensalada de lechuga, tomate y zanahoria",
  "Papa al horno",
  "Papa con calabaza y batata",
];

export const EXTRAS: Extra[] = [
  { id:'cuarto', label:'1/4 Presa de pollo extra', price:3500 },
  { id:'postre', label:'Postrecito de la casa extra', price:2000 },
  { id:'deshuesado', label:'Servicio de deshuesado', price:1500 },
]

export const WHATSAPP_NUMBER = '+5491130623998'

export function isExtra(product: Combo | Extra): product is Extra {
  return (product as Extra).label !== undefined;
}
