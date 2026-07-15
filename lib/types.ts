export type StockStatus = 'Disponible' | 'Reservado' | 'Preparacion' | 'Entregado';

export type NotificationPriority = 'Alta' | 'Media' | 'Baja';

export interface StockVehicle {
  id: string;
  brand: string;
  model: string;
  version: string;
  year: number;
  price: number;
  mileage: number;
  status: StockStatus;
  assignedAdvisor: string;
  branch: string;
  leadSource: string;
  publishedAt: string;
}

export interface Ucariano {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'Activo' | 'Onboarding' | 'Pausado';
  branch: string;
  activeDeals: number;
  monthlyGoal: number;
  closeRate: number;
}

export interface AgendaItem {
  id: string;
  customerName: string;
  vehicleLabel: string;
  advisorName: string;
  date: string;
  location: string;
  status: 'Confirmada' | 'Pendiente' | 'Reagendada' | 'Finalizada';
  channel: 'Sucursal' | 'Videollamada' | 'Terreno';
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  audience: string;
  priority: NotificationPriority;
  sentAt: string;
  channel: 'Push' | 'WhatsApp' | 'Email' | 'Interna';
  state: 'Programada' | 'Enviada' | 'Borrador';
}

export interface AdminDataset {
  stock: StockVehicle[];
  ucarianos: Ucariano[];
  agenda: AgendaItem[];
  notifications: NotificationItem[];
  source: 'notion' | 'mock';
}