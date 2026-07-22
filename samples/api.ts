export async function fetchUser(id: string) {
  return fetch(`/api/users/${id}`);
}
