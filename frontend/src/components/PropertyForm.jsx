import { useEffect, useState } from 'react';
import TextInput from './forms/TextInput';

const PIN_CODE_REGEX = /^[0-9]{6}$/;
const MOBILE_REGEX = /^[0-9]{10}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const getBackendBaseUrl = () => {
  const configuredBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
  return configuredBase.replace(/\/api\/?$/, '');
};

const resolveLogoPreview = (value) => {
  if (!value) {
    return '';
  }

  const stringValue = String(value);
  if (stringValue.startsWith('http://') || stringValue.startsWith('https://') || stringValue.startsWith('blob:')) {
    return stringValue;
  }

  const normalizedPath = stringValue.replace(/^\/+/, '');
  return `${getBackendBaseUrl()}/${normalizedPath}`;
};

const buildInitialForm = (initialData = {}) => ({
  name: initialData.name || '',
  fullAddress: initialData.fullAddress || initialData.location || '',
  pinCode: initialData.pinCode || '',
  city: initialData.city || '',
  state: initialData.state || '',
  mobileNumber: initialData.mobileNumber || '',
  landlineNumber: initialData.landlineNumber || '',
  email: initialData.email || '',
  website: initialData.website || '',
  gstNumber: initialData.gstNumber || '',
  description: initialData.description || '',
  longDescription: initialData.longDescription || '',
});

function PropertyForm({ initialData, onSubmit, isEditMode = false, isSubmitting = false }) {
  const [form, setForm] = useState(buildInitialForm(initialData));
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [errors, setErrors] = useState({});
  const [pinCodeLookupState, setPinCodeLookupState] = useState('idle');
  const [pinCodeLookupMessage, setPinCodeLookupMessage] = useState('');

  useEffect(() => {
    setForm(buildInitialForm(initialData));
    setLogoFile(null);
    setLogoPreview(resolveLogoPreview(initialData?.propertyLogo));
    setErrors({});
    setPinCodeLookupState('idle');
    setPinCodeLookupMessage('');
  }, [initialData]);

  useEffect(() => {
    if (!(logoFile instanceof File) || !logoPreview.startsWith('blob:')) {
      return undefined;
    }

    return () => {
      URL.revokeObjectURL(logoPreview);
    };
  }, [logoFile, logoPreview]);

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  useEffect(() => {
    const pinCode = String(form.pinCode || '').trim();

    if (!pinCode) {
      setPinCodeLookupState('idle');
      setPinCodeLookupMessage('');
      return;
    }

    if (!PIN_CODE_REGEX.test(pinCode)) {
      setPinCodeLookupState('idle');
      setPinCodeLookupMessage('');
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const fetchCityState = async () => {
      try {
        setPinCodeLookupState('loading');
        setPinCodeLookupMessage('Looking up city and state...');

        const response = await fetch(`https://api.postalpincode.in/pincode/${pinCode}`, { signal: controller.signal });
        const data = await response.json();
        const payload = Array.isArray(data) ? data[0] : null;
        const firstPostOffice = payload?.PostOffice?.[0];

        if (!firstPostOffice) {
          if (!isCancelled) {
            setPinCodeLookupState('error');
            setPinCodeLookupMessage('Could not resolve city/state from this pincode.');
            setForm((current) => ({ ...current, city: '', state: '' }));
          }
          return;
        }

        const city = (firstPostOffice.District || firstPostOffice.Name || '').trim();
        const state = (firstPostOffice.State || '').trim();

        if (!isCancelled) {
          setForm((current) => ({ ...current, city, state }));
          setPinCodeLookupState('success');
          setPinCodeLookupMessage('City and state fetched from pincode.');
        }
      } catch (error) {
        if (!isCancelled && error.name !== 'AbortError') {
          setPinCodeLookupState('error');
          setPinCodeLookupMessage('Unable to fetch city/state right now.');
          setForm((current) => ({ ...current, city: '', state: '' }));
        }
      }
    };

    fetchCityState();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [form.pinCode]);

  const validate = () => {
    const nextErrors = {};

    if (!String(form.name || '').trim()) {
      nextErrors.name = 'Property name is required';
    }

    if (!String(form.fullAddress || '').trim()) {
      nextErrors.fullAddress = 'Full address is required';
    }

    if (!PIN_CODE_REGEX.test(String(form.pinCode || '').trim())) {
      nextErrors.pinCode = 'Pin code must be exactly 6 digits';
    }

    if (!String(form.city || '').trim()) {
      nextErrors.city = 'City must be fetched from pincode';
    }

    if (!String(form.state || '').trim()) {
      nextErrors.state = 'State must be fetched from pincode';
    }

    if (String(form.mobileNumber || '').trim() && !MOBILE_REGEX.test(String(form.mobileNumber || '').trim())) {
      nextErrors.mobileNumber = 'Mobile number must be exactly 10 digits';
    }

    if (String(form.gstNumber || '').trim() && !GST_REGEX.test(String(form.gstNumber || '').trim().toUpperCase())) {
      nextErrors.gstNumber = 'GST number format is invalid';
    }

    if (!String(form.description || '').trim()) {
      nextErrors.description = 'Short description is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    const payload = {
      ...form,
      gstNumber: String(form.gstNumber || '').trim().toUpperCase(),
      pinCode: String(form.pinCode || '').trim(),
      city: String(form.city || '').trim(),
      state: String(form.state || '').trim(),
      location: form.fullAddress,
    };

    if (logoFile instanceof File) {
      payload.propertyLogo = logoFile;
    } else {
      delete payload.propertyLogo;
    }

    await onSubmit(payload);
  };

  return (
    <form className="space-y-5" onSubmit={submit}>
      <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
        <h4 className="text-sm font-bold uppercase tracking-[0.22em] text-slate-600">Basic details</h4>
        <TextInput
          label="Property name"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          required
        />
        <label className="space-y-1">
          <span className="text-sm font-semibold text-slate-700">Full address</span>
          <textarea
            value={form.fullAddress}
            onChange={(event) => setForm((current) => ({ ...current, fullAddress: event.target.value }))}
            required
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <div className="grid gap-3 md:grid-cols-3">
          <TextInput
            label="Pin code"
            value={form.pinCode}
            onChange={(event) => {
              const nextPinCode = event.target.value.replace(/\D/g, '').slice(0, 6);
              setForm((current) => ({
                ...current,
                pinCode: nextPinCode,
                ...(nextPinCode.length < 6 ? { city: '', state: '' } : {}),
              }));
              setErrors((current) => ({ ...current, pinCode: undefined, city: undefined, state: undefined }));
            }}
            pattern="[0-9]{6}"
            required
          />
          <TextInput label="City" value={form.city} disabled />
          <TextInput label="State" value={form.state} disabled />
        </div>
        {errors.pinCode ? <p className="text-xs font-medium text-red-600">{errors.pinCode}</p> : null}
        {errors.city ? <p className="text-xs font-medium text-red-600">{errors.city}</p> : null}
        {errors.state ? <p className="text-xs font-medium text-red-600">{errors.state}</p> : null}
        {pinCodeLookupMessage ? (
          <p className={`text-xs font-medium ${pinCodeLookupState === 'error' ? 'text-red-600' : 'text-slate-500'}`}>{pinCodeLookupMessage}</p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
        <h4 className="text-sm font-bold uppercase tracking-[0.22em] text-slate-600">Contact details</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput
            label="Mobile"
            value={form.mobileNumber}
            onChange={(event) => {
              const nextMobile = event.target.value.replace(/\D/g, '').slice(0, 10);
              setForm((current) => ({ ...current, mobileNumber: nextMobile }));
              setErrors((current) => ({ ...current, mobileNumber: undefined }));
            }}
            pattern="[0-9]{10}"
          />
          <TextInput
            label="Landline"
            value={form.landlineNumber}
            onChange={(event) => setForm((current) => ({ ...current, landlineNumber: event.target.value }))}
          />
          <TextInput
            label="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
          <TextInput
            label="Website"
            value={form.website}
            onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
          />
        </div>
        {errors.mobileNumber ? <p className="text-xs font-medium text-red-600">{errors.mobileNumber}</p> : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
        <h4 className="text-sm font-bold uppercase tracking-[0.22em] text-slate-600">Business</h4>
        <TextInput
          label="GST number"
          value={form.gstNumber}
          onChange={(event) => {
            const nextGst = event.target.value.toUpperCase().replace(/\s+/g, '');
            setForm((current) => ({ ...current, gstNumber: nextGst }));
            setErrors((current) => ({ ...current, gstNumber: undefined }));
          }}
        />
        {errors.gstNumber ? <p className="text-xs font-medium text-red-600">{errors.gstNumber}</p> : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
        <h4 className="text-sm font-bold uppercase tracking-[0.22em] text-slate-600">Branding</h4>
        <label className="space-y-1">
          <span className="text-sm font-semibold text-slate-700">Property logo</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        {logoPreview ? (
          <img src={logoPreview} alt="Property Logo" className="h-20 w-20 rounded-xl border border-slate-200 object-cover" />
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
        <h4 className="text-sm font-bold uppercase tracking-[0.22em] text-slate-600">Description</h4>
        <TextInput
          label="Short description"
          value={form.description}
          onChange={(event) => {
            setForm((current) => ({ ...current, description: event.target.value }));
            setErrors((current) => ({ ...current, description: undefined }));
          }}
          required
        />
        {errors.description ? <p className="text-xs font-medium text-red-600">{errors.description}</p> : null}
        <label className="space-y-1">
          <span className="text-sm font-semibold text-slate-700">Long description</span>
          <textarea
            value={form.longDescription}
            onChange={(event) => setForm((current) => ({ ...current, longDescription: event.target.value }))}
            rows={4}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
      </section>

      <button disabled={isSubmitting} className="w-full rounded-2xl bg-brand-700 py-3 font-semibold text-white hover:bg-brand-800 disabled:opacity-70">
        {isSubmitting ? (isEditMode ? 'Saving...' : 'Creating...') : isEditMode ? 'Save property' : 'Create property'}
      </button>
    </form>
  );
}

export default PropertyForm;
