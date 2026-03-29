import { NextResponse } from 'next/server'
import { requireModuleAccess, isGuardError } from '@/lib/supabase/guard'
import type { ContractType } from '@/lib/marketing/types'

const VALID_CONTRACT_TYPES: ContractType[] = [
  'cash',
  'accumulator',
  'hta',
  'options',
  'min-price',
  'basis',
]

// PATCH /api/marketing/contracts/[id]
// Updates an existing grain contract. Accepts partial body.
// updated_at is set server-side (Phase 56 decision: client cannot set arbitrary timestamps).
// MKT-01: Contract CRUD — edit contracts.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireModuleAccess('marketing')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { id } = params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Build update object from provided fields only
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (typeof body.crop === 'string') {
    updateData.crop = body.crop.trim()
  }
  if (typeof body.registry_crop_id === 'string' || body.registry_crop_id === null) {
    updateData.registry_crop_id = body.registry_crop_id
  }
  if (
    typeof body.contract_type === 'string' &&
    VALID_CONTRACT_TYPES.includes(body.contract_type as ContractType)
  ) {
    updateData.contract_type = body.contract_type
  }
  if (typeof body.bushels === 'number') {
    updateData.bushels = body.bushels
  }
  if (typeof body.price_per_bushel === 'number' || body.price_per_bushel === null) {
    updateData.price_per_bushel = body.price_per_bushel
  }
  if (typeof body.basis === 'number' || body.basis === null) {
    updateData.basis = body.basis
  }
  if (typeof body.futures_reference === 'number' || body.futures_reference === null) {
    updateData.futures_reference = body.futures_reference
  }
  if (typeof body.buyer === 'string' || body.buyer === null) {
    updateData.buyer = body.buyer
  }
  if (typeof body.delivery_start === 'string' || body.delivery_start === null) {
    updateData.delivery_start = body.delivery_start
  }
  if (typeof body.delivery_end === 'string' || body.delivery_end === null) {
    updateData.delivery_end = body.delivery_end
  }
  if (typeof body.crop_year === 'number') {
    updateData.crop_year = body.crop_year
  }
  if (typeof body.notes === 'string' || body.notes === null) {
    updateData.notes = body.notes
  }

  const { data: contract, error } = await supabase
    .from('grain_contracts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to update grain contract', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ contract })
}

// DELETE /api/marketing/contracts/[id]
// Removes a grain contract. Returns 204 on success, 404 if not found.
// MKT-01: Contract CRUD — delete contracts.
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireModuleAccess('marketing')
  if (isGuardError(guard)) return guard
  const { supabase } = guard

  const { id } = params

  const { data, error } = await supabase
    .from('grain_contracts')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) {
    return NextResponse.json(
      { error: 'Failed to delete grain contract', details: error.message },
      { status: 500 }
    )
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Grain contract not found' }, { status: 404 })
  }

  return new NextResponse(null, { status: 204 })
}
