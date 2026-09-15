import { TenantBranding } from '../types/logistics';

export async function fetchCompanyBranding(tenantId?: string): Promise<TenantBranding> {
  const token = localStorage.getItem('delivere_auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const res = await fetch(`/api/company/branding${query}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل تحميل بيانات الهوية التجارية');
  }
  const data = await res.json();
  return data.branding;
}

export async function updateCompanyBranding(branding: Partial<TenantBranding>): Promise<TenantBranding> {
  const token = localStorage.getItem('delivere_auth_token');
  const res = await fetch('/api/company/branding', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(branding),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل تحديث بيانات الهوية التجارية');
  }
  const data = await res.json();
  return data.branding;
}

export async function uploadCompanyLogo(file: File): Promise<string> {
  const token = localStorage.getItem('delivere_auth_token');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const imageBase64 = reader.result as string;
        const res = await fetch('/api/company/branding/logo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            imageBase64,
            fileName: file.name,
            mimeType: file.type,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'فشل رفع الشعار');
        }

        const data = await res.json();
        resolve(data.logoUrl);
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('فشل قراءة ملف الصورة'));
    reader.readAsDataURL(file);
  });
}
