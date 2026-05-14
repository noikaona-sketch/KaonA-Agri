import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    // fallback: คืนค่าว่างถ้าไม่มี key
    return NextResponse.json({ subdistrict: '', district: '', province: '', fullAddress: '' });
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=th`,
    );
    const data = (await res.json()) as {
      results?: {
        formatted_address?: string;
        address_components?: { long_name: string; types: string[] }[];
      }[];
      status?: string;
    };

    if (data.status !== 'OK' || !data.results?.[0]) {
      return NextResponse.json({ subdistrict: '', district: '', province: '', fullAddress: '' });
    }

    const components = data.results[0].address_components ?? [];
    const get = (type: string) =>
      components.find((c) => c.types.includes(type))?.long_name ?? '';

    // Google Maps Thailand: sublocality_level_1=ตำบล, locality=อำเภอ, administrative_area_level_1=จังหวัด
    const subdistrict = get('sublocality_level_1') || get('sublocality') || get('neighborhood');
    const district    = get('locality') || get('administrative_area_level_2');
    const province    = get('administrative_area_level_1');

    return NextResponse.json({
      subdistrict: subdistrict.replace(/^ตำบล|^แขวง/, '').trim(),
      district:    district.replace(/^อำเภอ|^เขต/, '').trim(),
      province:    province.replace(/^จังหวัด/, '').trim(),
      fullAddress: data.results[0].formatted_address ?? '',
    });
  } catch (e) {
    console.error('[REVERSE_GEOCODE]', e);
    return NextResponse.json({ subdistrict: '', district: '', province: '', fullAddress: '' });
  }
}
