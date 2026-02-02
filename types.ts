export enum Origin {
  BUSINESS = 'Negocio',
  HOME = 'Hogar'
}

export enum TransactionType {
  INCOME = 'Ingreso',
  EXPENSE = 'Gasto'
}

export enum TransactionStatus {
  PAID = 'paid',
  PENDING = 'pending'
}

export enum TimeFilter {
  WEEK = 'Semana',
  MONTH = 'Mes',
  YEAR = 'Año'
}

export interface Transaction {
  id?: string;
  amount: number;
  type: TransactionType;
  origin: Origin;
  category: string;
  client?: string; // Optional client name
  date: number; // Timestamp
  note: string;
  userId: string;
  consumer?: string; // For internal consumption logic
  status: TransactionStatus; // New field for Paid vs Fiado
}

export const CONSUMERS = ["Amarilis", "Luis", "Hijos", "Invitados"];

export const BUSINESS_TABS = {
  CONSUMO_CLIENTES: "Consumo Clientes",
  VENTA_PRODUCTO: "Venta Producto",
  INVENTARIO_INICIAL: "Inventario Inicial", // New
  PAGO_TARJETA: "Pago Tarjeta", // New
  GASTOS: "Gastos",
  CONSUMO_PROPIO: "Consumo Propio",
  REGALIAS: "Regalías"
};

export const BUSINESS_EXPENSE_CATEGORIES = [
  "Arriendo Local",
  "Servicios",
  "Insumos",
  "Transporte",
  "Mantenimiento",
  "Otros"
];

// Updated Home Categories to include Aporte Familiar
export const HOME_CATEGORIES = [
  "Arriendo",
  "Servicios",
  "Comida",
  "Transporte",
  "Ocio",
  "Aporte Familiar",
  "Otros"
];