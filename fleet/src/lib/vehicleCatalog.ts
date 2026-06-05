// Araç marka / model kataloğu — FRONTEND constant'ı (backend'e yük YOK).
// Yeni marka veya model eklemek/çıkarmak için YALNIZCA bu dosyayı düzenle;
// form (vehicles/new + vehicles/edit) BrandModelPicker üzerinden buradan okur.
//
// Liste TR filolarında yaygın ticari (van/kamyon/çekici) + sık binek markalara
// odaklı. Listede olmayan için kullanıcı "Diğer" seçip serbest metin girer.

// "Diğer" (listede yok → serbest metin) için Picker sentinel değeri.
export const OTHER = '__other__';

export const VEHICLE_BRANDS: string[] = [
  'Ford',
  'Mercedes-Benz',
  'Volkswagen',
  'Renault',
  'Fiat',
  'Peugeot',
  'Citroën',
  'Opel',
  'Iveco',
  'Toyota',
  'Hyundai',
  'Isuzu',
  'Dacia',
  'Nissan',
  'BMC',
  'Karsan',
  'Mitsubishi',
  'Volvo',
  'Scania',
  'MAN',
  'DAF',
  'Renault Trucks',
  'Honda',
  'Kia',
  'Škoda',
];

// Marka → model listesi. Ticari modeller önce, sık binek sonra.
export const VEHICLE_MODELS: Record<string, string[]> = {
  Ford: ['Transit', 'Transit Custom', 'Transit Courier', 'Tourneo Custom', 'Tourneo Courier', 'Ranger', 'Cargo', 'F-MAX', 'Focus', 'Fiesta'],
  'Mercedes-Benz': ['Vito', 'Sprinter', 'Citan', 'V-Class', 'eVito', 'Atego', 'Actros', 'Axor', 'Arocs'],
  Volkswagen: ['Transporter', 'Caddy', 'Crafter', 'Caravelle', 'Amarok', 'Polo', 'Passat', 'Golf'],
  Renault: ['Kangoo', 'Trafic', 'Master', 'Express', 'Clio', 'Mégane', 'Symbol', 'Talisman'],
  Fiat: ['Doblo', 'Fiorino', 'Ducato', 'Talento', 'Scudo', 'Egea'],
  Peugeot: ['Partner', 'Expert', 'Boxer', 'Bipper', 'Rifter', '301', '308', '2008'],
  'Citroën': ['Berlingo', 'Jumpy', 'Jumper', 'Nemo', 'C-Elysée'],
  Opel: ['Combo', 'Vivaro', 'Movano', 'Astra', 'Corsa', 'Insignia'],
  Iveco: ['Daily', 'Eurocargo', 'S-Way', 'Stralis', 'Trakker'],
  Toyota: ['Hilux', 'Proace', 'Proace City', 'Corolla', 'Yaris', 'C-HR', 'RAV4'],
  Hyundai: ['H-1', 'H350', 'Starex', 'i20', 'Accent Blue', 'Tucson'],
  Isuzu: ['D-Max', 'NPR', 'NLR', 'NQR', 'Novociti', 'Turkuaz'],
  Dacia: ['Dokker', 'Lodgy', 'Duster', 'Sandero', 'Logan'],
  Nissan: ['NV200', 'Primastar', 'Interstar', 'Navara', 'Qashqai'],
  BMC: ['Tuğra', 'Pro', 'Fatih', 'Levend'],
  Karsan: ['Jest', 'Atak', 'Star', 'e-Jest'],
  Mitsubishi: ['L200', 'Canter'],
  Volvo: ['FH', 'FM', 'FL', 'FE'],
  Scania: ['R Serisi', 'S Serisi', 'G Serisi', 'P Serisi'],
  MAN: ['TGX', 'TGS', 'TGM', 'TGL'],
  DAF: ['XF', 'CF', 'LF'],
  'Renault Trucks': ['T', 'C', 'D'],
  Honda: ['Civic', 'CR-V', 'City', 'HR-V'],
  Kia: ['Sportage', 'Ceed', 'Picanto', 'Stonic'],
  'Škoda': ['Octavia', 'Superb', 'Fabia', 'Kamiq'],
};

export function modelsForBrand(brand: string): string[] {
  return VEHICLE_MODELS[brand] ?? [];
}
