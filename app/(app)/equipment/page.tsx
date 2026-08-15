import { EquipmentView } from '@/components/equipment/equipment-view'

export const metadata = {
  title: 'Equipment — FlexFit Studio',
  description:
    'Asset register, maintenance and fault log for every machine on the floor, plus member reservations for bookable equipment.',
}

export default function EquipmentPage() {
  return <EquipmentView />
}
