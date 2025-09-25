import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'

import { createUser } from '../../api/users'
import type { CreateUserPayload } from '../../api/users'
import { UserForm, DEFAULT_VALUES } from '../../components/users'

const CreateUserPage = () => {
  const mutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
  })

  return (
    <UserForm
      mode="create"
      initialValues={DEFAULT_VALUES}
      isSubmitting={mutation.isPending}
      error={mutation.error as AxiosError | null}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values)
      }}
    />
  )
}

export default CreateUserPage
