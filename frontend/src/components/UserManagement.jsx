import { useMemo, useState } from 'react';
import Modal from './Modal';
import TextInput from './forms/TextInput';
import PermissionEditor from './PermissionEditor';
import SearchSelect from './SearchSelect';

const initialPermissions = {
  canManageProperties: false,
  canManageRooms: false,
  canManagePricing: false,
  canManageInventory: false,
};

function UserManagement({ users, properties, onCreate, onUpdate, onDelete, onAssignProperty, onRemoveProperty, loading }) {
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    permissions: initialPermissions,
    propertyIds: [],
  });

  const filteredProperties = useMemo(
    () => properties.filter((property) => property.name.toLowerCase().includes(search.toLowerCase())),
    [properties, search],
  );

  const propertyOptions = useMemo(
    () =>
      properties.map((property) => ({
        value: property.id,
        label: property.name,
        meta: property.location,
      })),
    [properties],
  );

  const reset = () => {
    setForm({ name: '', email: '', password: '', permissions: initialPermissions, propertyIds: [] });
    setSearch('');
    setEditingUser(null);
    setOpen(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      permissions: form.permissions,
      propertyIds: form.propertyIds,
    };

    if (editingUser) {
      await onUpdate(editingUser.id, payload);
    } else {
      await onCreate(payload);
    }

    reset();
  };

  const assignPropertyToUser = async (userId, propertyId) => {
    if (!propertyId) {
      return;
    }

    await onAssignProperty({ userId, propertyId });
  };

  const removePropertyFromUser = async (userId, propertyId) => {
    await onRemoveProperty({ userId, propertyId });
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', password: '', permissions: initialPermissions, propertyIds: [] });
    setOpen(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      permissions: user.permissions || initialPermissions,
      propertyIds: (user.managedProperties || []).map((property) => property.id),
    });
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Manager accounts</h3>
          <p className="text-sm text-slate-500">Create managers, assign properties, and set granular permissions.</p>
        </div>
        <button onClick={openCreate} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Create manager
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Name</th>
              <th className="px-4 py-3 text-left font-semibold">Email</th>
              <th className="px-4 py-3 text-left font-semibold">Properties</th>
              <th className="px-4 py-3 text-left font-semibold">Permissions</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-900">{user.name}</td>
                <td className="px-4 py-3 text-slate-600">{user.email}</td>
                <td className="px-4 py-3 text-slate-600">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {(user.managedProperties || []).map((property) => (
                        <button
                          key={`${user.id}-${property.id}`}
                          type="button"
                          onClick={() => removePropertyFromUser(user.id, property.id)}
                          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-red-50 hover:text-red-700"
                        >
                          {property.name} ×
                        </button>
                      ))}
                      {(user.managedProperties || []).length === 0 ? <span>Unassigned</span> : null}
                    </div>
                    <SearchSelect
                      label=""
                      options={propertyOptions.filter((property) => !(user.managedPropertyIds || []).includes(property.value))}
                      value=""
                      onChange={(propertyId) => assignPropertyToUser(user.id, propertyId)}
                      placeholder="Assign property"
                      emptyLabel="No available properties"
                    />
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {Object.entries(user.permissions || {})
                    .filter(([, enabled]) => enabled)
                    .map(([key]) => key)
                    .join(', ') || 'No permissions'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(user)} className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
                      Edit
                    </button>
                    <button onClick={() => onDelete(user.id)} className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} title={editingUser ? 'Edit manager' : 'Create manager'} onClose={reset}>
        <form className="space-y-4" onSubmit={submit}>
          <TextInput label="Name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          <TextInput label="Email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
          <TextInput
            label={editingUser ? 'Password (leave blank to keep current)' : 'Password'}
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            required={!editingUser}
          />

          <PermissionEditor value={form.permissions} onChange={(permissions) => setForm((current) => ({ ...current, permissions }))} />

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-700">Assign properties by name</p>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search properties..."
              className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            <div className="max-h-44 space-y-2 overflow-auto rounded-2xl border border-slate-200 p-3">
              {filteredProperties.map((property) => {
                const checked = form.propertyIds.includes(property.id);
                return (
                  <label key={property.id} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{property.name}</p>
                      <p className="text-xs text-slate-500">{property.location}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setForm((current) => ({
                          ...current,
                          propertyIds: event.target.checked
                            ? [...current.propertyIds, property.id]
                            : current.propertyIds.filter((id) => id !== property.id),
                        }));
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <button disabled={loading} className="w-full rounded-2xl bg-brand-700 py-3 font-semibold text-white hover:bg-brand-800">
            {editingUser ? 'Save changes' : 'Create manager'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

export default UserManagement;