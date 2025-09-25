import axios from 'axios'

export interface CepAddress {
  street?: string
  neighborhood?: string
  city?: string
  state?: string
}

export const lookupCep = async (cep: string): Promise<CepAddress> => {
  const sanitized = cep.replace(/\D/g, '')
  if (sanitized.length !== 8) {
    throw new Error('CEP inválido')
  }

  const { data } = await axios.get<{ erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }>(
    `https://viacep.com.br/ws/${sanitized}/json/`,
  )

  if (data.erro) {
    throw new Error('CEP não encontrado')
  }

  return {
    street: data.logradouro,
    neighborhood: data.bairro,
    city: data.localidade,
    state: data.uf,
  }
}
