// Shared mock data for the 3 travel-map design previews.
export type MockCountry = {
  name: string
  iso2: string
  flag: string
  visits: number
  photos: number
  entries: number
  lastVisit: string
  samplePhotos: string[] // can be empty
  note?: string
}

// Use Unsplash photos so the mockups look real without needing real user data.
const sampleImg = (id: string, size = 400) => `https://images.unsplash.com/${id}?w=${size}&auto=format&fit=crop`

export const MOCK_VISITED: MockCountry[] = [
  { name: 'Australia', iso2: 'AU', flag: '🇦🇺', visits: 3, photos: 42, entries: 8, lastVisit: '2026-03-18',
    samplePhotos: [sampleImg('photo-1523482580672-f109ba8cb9be'), sampleImg('photo-1506973035872-a4ec16b8e8d9'), sampleImg('photo-1529108190281-9a4f620bc2d8')] },
  { name: 'Thailand', iso2: 'TH', flag: '🇹🇭', visits: 2, photos: 31, entries: 5, lastVisit: '2025-11-02',
    samplePhotos: [sampleImg('photo-1528181304800-259b08848526'), sampleImg('photo-1540541338287-41700207dee6')] },
  { name: 'Japan', iso2: 'JP', flag: '🇯🇵', visits: 1, photos: 58, entries: 11, lastVisit: '2025-04-12',
    samplePhotos: [sampleImg('photo-1528164344705-47542687000d'), sampleImg('photo-1492571350019-22de08371fd3')] },
  { name: 'Vietnam', iso2: 'VN', flag: '🇻🇳', visits: 1, photos: 22, entries: 4, lastVisit: '2024-09-21', samplePhotos: [sampleImg('photo-1528127269322-539801943592')] },
  { name: 'Cambodia', iso2: 'KH', flag: '🇰🇭', visits: 1, photos: 15, entries: 3, lastVisit: '2024-08-10', samplePhotos: [sampleImg('photo-1508009603885-50cf7c579365')] },
  { name: 'Indonesia', iso2: 'ID', flag: '🇮🇩', visits: 2, photos: 27, entries: 6, lastVisit: '2025-02-04', samplePhotos: [sampleImg('photo-1537996194471-e657df975ab4')] },
  { name: 'New Zealand', iso2: 'NZ', flag: '🇳🇿', visits: 1, photos: 19, entries: 3, lastVisit: '2024-12-30', samplePhotos: [sampleImg('photo-1469854523086-cc02fe5d8800')] },
  { name: 'Italy', iso2: 'IT', flag: '🇮🇹', visits: 2, photos: 34, entries: 7, lastVisit: '2025-06-14', samplePhotos: [sampleImg('photo-1552832230-c0197dd311b5')] },
  { name: 'France', iso2: 'FR', flag: '🇫🇷', visits: 1, photos: 18, entries: 4, lastVisit: '2024-07-05', samplePhotos: [sampleImg('photo-1502602898657-3e91760cbb34')] },
  { name: 'Spain', iso2: 'ES', flag: '🇪🇸', visits: 1, photos: 23, entries: 5, lastVisit: '2024-05-20', samplePhotos: [sampleImg('photo-1509840841025-9088ba78a826')] },
  { name: 'United Kingdom', iso2: 'GB', flag: '🇬🇧', visits: 2, photos: 17, entries: 4, lastVisit: '2025-08-30', samplePhotos: [sampleImg('photo-1533929736458-ca588d08c8be')] },
  { name: 'United States of America', iso2: 'US', flag: '🇺🇸', visits: 3, photos: 65, entries: 12, lastVisit: '2025-10-11', samplePhotos: [sampleImg('photo-1485871981521-5b1fd3805eee'), sampleImg('photo-1496588152823-86ff7695e68f')] },
  { name: 'Mexico', iso2: 'MX', flag: '🇲🇽', visits: 1, photos: 12, entries: 3, lastVisit: '2024-03-18', samplePhotos: [sampleImg('photo-1518638150340-f706e86654de')] },
  { name: 'Peru', iso2: 'PE', flag: '🇵🇪', visits: 1, photos: 29, entries: 6, lastVisit: '2024-11-08', samplePhotos: [sampleImg('photo-1526392060635-9d6019884377')] },
  { name: 'Brazil', iso2: 'BR', flag: '🇧🇷', visits: 1, photos: 14, entries: 3, lastVisit: '2025-01-22', samplePhotos: [sampleImg('photo-1483729558449-99ef09a8c325')] },
]

export const TOTAL_COUNTRIES = 195
export const visitedSet = new Set(MOCK_VISITED.map(c => c.name))
export const lookupCountry = (name: string) => MOCK_VISITED.find(c => c.name === name)

export const GEO_URL = 'https://unpkg.com/world-atlas@2/countries-110m.json'
