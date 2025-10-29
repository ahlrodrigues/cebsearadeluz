import { http } from './http'

export type TicketReserveRequest = {
  count: number
  pass_type?: string | null
  date?: string | null
}

export type TicketReserveItem = {
  ticket_number: number
  scanned_for: string
  pass_type?: string | null
}

export async function reserveTickets(req: TicketReserveRequest): Promise<TicketReserveItem[]> {
  const { data } = await http.post<TicketReserveItem[]>('/tickets/reserve', req)
  return data
}

