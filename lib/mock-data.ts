import type { AdminDataset } from '@/lib/types';

export const mockDataset: AdminDataset = {
  source: 'mock',
  stock: [
    {
      id: 'st-01',
      brand: 'Mazda',
      model: 'CX-5',
      version: '2.5 AWD Signature',
      year: 2022,
      price: 22990000,
      mileage: 27800,
      status: 'Disponible',
      assignedAdvisor: 'Catalina Rojas',
      branch: 'Vitacura',
      leadSource: 'Marketplace',
      publishedAt: '2026-07-10T09:00:00.000Z'
    },
    {
      id: 'st-02',
      brand: 'BMW',
      model: '320i',
      version: 'Sport Line',
      year: 2021,
      price: 25800000,
      mileage: 31450,
      status: 'Reservado',
      assignedAdvisor: 'Tomás Vega',
      branch: 'La Dehesa',
      leadSource: 'Instagram',
      publishedAt: '2026-07-11T13:30:00.000Z'
    },
    {
      id: 'st-03',
      brand: 'Toyota',
      model: 'Hilux',
      version: 'SRX 4x4 AT',
      year: 2023,
      price: 33990000,
      mileage: 12600,
      status: 'Preparacion',
      assignedAdvisor: 'Javiera Mena',
      branch: 'Huechuraba',
      leadSource: 'Web Ucars',
      publishedAt: '2026-07-12T11:15:00.000Z'
    },
    {
      id: 'st-04',
      brand: 'Audi',
      model: 'Q3',
      version: '35 TFSI',
      year: 2020,
      price: 21450000,
      mileage: 45200,
      status: 'Entregado',
      assignedAdvisor: 'Martín Salas',
      branch: 'Vitacura',
      leadSource: 'Referido',
      publishedAt: '2026-07-06T15:40:00.000Z'
    }
  ],
  ucarianos: [
    {
      id: 'uc-01',
      name: 'Catalina Rojas',
      email: 'catalina@ucars.cl',
      phone: '+56 9 4412 8891',
      status: 'Activo',
      branch: 'Vitacura',
      activeDeals: 8,
      monthlyGoal: 10,
      closeRate: 62
    },
    {
      id: 'uc-02',
      name: 'Tomás Vega',
      email: 'tomas@ucars.cl',
      phone: '+56 9 3581 7710',
      status: 'Activo',
      branch: 'La Dehesa',
      activeDeals: 6,
      monthlyGoal: 9,
      closeRate: 58
    },
    {
      id: 'uc-03',
      name: 'Javiera Mena',
      email: 'javiera@ucars.cl',
      phone: '+56 9 5122 4308',
      status: 'Onboarding',
      branch: 'Huechuraba',
      activeDeals: 3,
      monthlyGoal: 7,
      closeRate: 41
    },
    {
      id: 'uc-04',
      name: 'Martín Salas',
      email: 'martin@ucars.cl',
      phone: '+56 9 6760 1908',
      status: 'Pausado',
      branch: 'Vitacura',
      activeDeals: 1,
      monthlyGoal: 6,
      closeRate: 35
    }
  ],
  agenda: [
    {
      id: 'ag-01',
      customerName: 'Francisca Silva',
      vehicleLabel: 'Mazda CX-5 2.5 AWD Signature',
      advisorName: 'Catalina Rojas',
      date: '2026-07-15T14:30:00.000Z',
      location: 'Sucursal Vitacura',
      status: 'Confirmada',
      channel: 'Sucursal'
    },
    {
      id: 'ag-02',
      customerName: 'Benjamín Torres',
      vehicleLabel: 'BMW 320i Sport Line',
      advisorName: 'Tomás Vega',
      date: '2026-07-15T17:00:00.000Z',
      location: 'Google Meet',
      status: 'Pendiente',
      channel: 'Videollamada'
    },
    {
      id: 'ag-03',
      customerName: 'Isidora Peña',
      vehicleLabel: 'Toyota Hilux SRX 4x4 AT',
      advisorName: 'Javiera Mena',
      date: '2026-07-16T10:15:00.000Z',
      location: 'Showroom Huechuraba',
      status: 'Reagendada',
      channel: 'Sucursal'
    },
    {
      id: 'ag-04',
      customerName: 'Andrés Figueroa',
      vehicleLabel: 'Audi Q3 35 TFSI',
      advisorName: 'Martín Salas',
      date: '2026-07-14T12:00:00.000Z',
      location: 'Condominio Los Trapenses',
      status: 'Finalizada',
      channel: 'Terreno'
    }
  ],
  notifications: [
    {
      id: 'nt-01',
      title: 'Nuevos leads sin asignar',
      message: 'Hay 6 contactos entrantes de marketplace esperando reparto entre Vitacura y La Dehesa.',
      audience: 'Jefatura comercial',
      priority: 'Alta',
      sentAt: '2026-07-14T09:05:00.000Z',
      channel: 'Interna',
      state: 'Enviada'
    },
    {
      id: 'nt-02',
      title: 'Cambio de precio recomendado',
      message: 'La Hilux SRX lleva 19 días en preparación; sugerido ajustar publicación antes del viernes.',
      audience: 'Equipo stock',
      priority: 'Media',
      sentAt: '2026-07-14T11:40:00.000Z',
      channel: 'Email',
      state: 'Programada'
    },
    {
      id: 'nt-03',
      title: 'Recordatorio de seguimiento',
      message: 'Se detectaron 4 reuniones finalizadas sin nota comercial en Notion.',
      audience: 'Ucarianos activos',
      priority: 'Baja',
      sentAt: '2026-07-14T08:15:00.000Z',
      channel: 'WhatsApp',
      state: 'Borrador'
    }
  ]
};