import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Picker, type PickerOption } from '@/components/Picker';
import { TextField } from '@/components/TextField';
import { OTHER, VEHICLE_BRANDS, modelsForBrand } from '@/lib/vehicleCatalog';
import { theme } from '@/theme';

type Props = {
  brand: string;
  model: string;
  onBrandChange: (v: string) => void;
  onModelChange: (v: string) => void;
  brandError?: string;
  modelError?: string;
};

/**
 * Marka → model cascading selectbox'ları (frontend katalog: @/lib/vehicleCatalog).
 * Listede olmayan için "Diğer" → serbest metin (custom marka → model de serbest).
 *
 * Controlled: brand/model değerleri + setter'lar dışarıdan (RHF setValue) gelir.
 * "Diğer" modu mount'ta prop'lardan türetilir; edit formu BrandModelPicker'ı
 * yalnızca veri yüklendikten (reset) sonra render ettiği için useEffect sync
 * gerekmez — initializer doğru başlangıcı görür, kullanıcı seçimi ezilmez.
 */
export function BrandModelPicker({
  brand,
  model,
  onBrandChange,
  onModelChange,
  brandError,
  modelError,
}: Props) {
  const { t } = useTranslation();

  const [brandOther, setBrandOther] = useState(
    () => brand !== '' && !VEHICLE_BRANDS.includes(brand),
  );
  const [modelOther, setModelOther] = useState(() => {
    if (brand !== '' && !VEHICLE_BRANDS.includes(brand)) return true;
    return model !== '' && !modelsForBrand(brand).includes(model);
  });

  const models = modelsForBrand(brand);
  const otherLabel = t('vehicles.new.other');

  const brandOptions: PickerOption[] = [
    ...VEHICLE_BRANDS.map((b) => ({ value: b, label: b })),
    { value: OTHER, label: otherLabel, icon: 'edit-3' },
  ];
  const modelOptions: PickerOption[] = [
    ...models.map((m) => ({ value: m, label: m })),
    { value: OTHER, label: otherLabel, icon: 'edit-3' },
  ];

  const errHelper = (msg?: string) =>
    msg ? <Text style={styles.error}>{msg}</Text> : undefined;

  const handleBrand = (v: string | null) => {
    if (v === OTHER) {
      setBrandOther(true);
      onBrandChange('');
    } else {
      setBrandOther(false);
      onBrandChange(v ?? '');
    }
    // Marka değişti → modeli sıfırla (yeni markanın model listesi farklı).
    setModelOther(false);
    onModelChange('');
  };

  const handleModel = (v: string | null) => {
    if (v === OTHER) {
      setModelOther(true);
      onModelChange('');
    } else {
      setModelOther(false);
      onModelChange(v ?? '');
    }
  };

  return (
    <View style={styles.wrap}>
      {/* MARKA */}
      <View style={styles.group}>
        <Picker
          label={t('vehicles.new.brand')}
          icon="award"
          value={brandOther ? OTHER : VEHICLE_BRANDS.includes(brand) ? brand : null}
          options={brandOptions}
          placeholder={t('vehicles.new.brandSelect')}
          onChange={handleBrand}
          helper={!brandOther ? errHelper(brandError) : undefined}
        />
        {brandOther ? (
          <TextField
            icon="edit-3"
            placeholder={t('vehicles.new.brandPlaceholder')}
            autoCapitalize="words"
            value={brand}
            onChangeText={onBrandChange}
            error={brandError}
          />
        ) : null}
      </View>

      {/* MODEL */}
      <View style={styles.group}>
        {brandOther ? (
          // Custom marka → model listesi yok, serbest metin.
          <TextField
            label={t('vehicles.new.model')}
            icon="layers"
            placeholder={t('vehicles.new.modelPlaceholder')}
            autoCapitalize="words"
            value={model}
            onChangeText={onModelChange}
            error={modelError}
          />
        ) : (
          <>
            <Picker
              label={t('vehicles.new.model')}
              icon="layers"
              value={modelOther ? OTHER : models.includes(model) ? model : null}
              options={modelOptions}
              placeholder={brand ? t('vehicles.new.modelSelect') : t('vehicles.new.modelSelectFirst')}
              onChange={handleModel}
              helper={!modelOther ? errHelper(modelError) : undefined}
            />
            {modelOther ? (
              <TextField
                icon="edit-3"
                placeholder={t('vehicles.new.modelPlaceholder')}
                autoCapitalize="words"
                value={model}
                onChangeText={onModelChange}
                error={modelError}
              />
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing.md },
  group: { gap: 8 },
  error: { color: theme.colors.danger, fontSize: theme.font.size.xs, marginTop: 2 },
});
