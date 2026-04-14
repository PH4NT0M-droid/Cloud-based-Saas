import { useMemo, useState } from 'react';
import Modal from './Modal';
import TextInput from './forms/TextInput';

const propertyScopedPermissionOptions = [
  { key: 'MANAGE_PROPERTY', label: 'Manage Property' },
  { key: 'MANAGE_ROOMS', label: 'Manage Rooms' },
  { key: 'MANAGE_BOOKINGS', label: 'Manage Bookings' },
  { key: 'MANAGE_PRICING', label: 'Manage Pricing' },
  { key: 'MANAGE_INVENTORY', label: 'Manage Inventory' },
];

const applyScopedPermissionInheritance = (permissions = []) => {
  const next = new Set(permissions);

  if (next.has('MANAGE_PROPERTY')) {
    next.add('MANAGE_ROOMS');
    next.add('MANAGE_BOOKINGS');
    next.add('MANAGE_PRICING');
    next.add('MANAGE_INVENTORY');
  }

  if (next.has('MANAGE_ROOMS')) {
    next.add('MANAGE_PRICING');
    next.add('MANAGE_INVENTORY');
  }

  return [...next];
};

const isForcedByParent = (permissions = [], permission) => {
  const active = new Set(permissions);

  if (active.has('MANAGE_PROPERTY') && permission !== 'MANAGE_PROPERTY') {
    return true;
  }

  if (active.has('MANAGE_ROOMS') && (permission === 'MANAGE_PRICING' || permission === 'MANAGE_INVENTORY')) {
    return true;
  }

  return false;
};

const buildInitialForm = () => ({
  name: '',
  email: '',
  password: '',
});

const normalizePropertyPermissions = (value = {}) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((acc, [propertyId, permissions]) => {
    if (!propertyId || !Array.isArray(permissions)) {
      return acc;
    }

    const remapped = permissions
      .filter((permission) => typeof permission === 'string' && permission.trim().length > 0)
      .map((permission) => {
        if (permission === 'VIEW_BOOKINGS') {
          return 'MANAGE_BOOKINGS';
        }

        if (permission === 'EDIT_PROPERTY') {
          return 'MANAGE_PROPERTY';
        }

        return permission;
      });

    const cleaned = applyScopedPermissionInheritance([...new Set(remapped)]);
    if (cleaned.length > 0) {
      acc[propertyId] = cleaned;
    }
    return acc;
  }, {});
};

function UserManagement({ users, properties, onCreate, onUpdate, onDelete, loading }) {
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [expandedProperty, setExpandedProperty] = useState(null);
  const [propertySearch, setPropertySearch] = useState('');
  const [propertyPermissions, setPropertyPermissions] = useState({});
  const [form, setForm] = useState(buildInitialForm);

  const filteredProperties = useMemo(() => {
    const needle = propertySearch.trim().toLowerCase();
    if (!needle) {
      return properties;
    }

    return properties.filter((property) => {
      const haystack = [property.name, property.location, property.city, property.state].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [properties, propertySearch]);

  const reset = () => {
    setForm(buildInitialForm());
    setExpandedProperty(null);
    setPropertySearch('');
    setPropertyPermissions({});
    setEditingUser(null);
    setOpen(false);
  };

  const toggleExpand = (propertyId) => {
    setExpandedProperty((current) => (current === propertyId ? null : propertyId));
  };

  const togglePropertyPermission = (propertyId, permission) => {
    setPropertyPermissions((current) => {
      const existing = applyScopedPermissionInheritance(current[propertyId] || []);
      const nextSet = new Set(existing);

      if (nextSet.has(permission)) {
        nextSet.delete(permission);

        if (permission === 'MANAGE_PROPERTY') {
          nextSet.delete('MANAGE_ROOMS');
          nextSet.delete('MANAGE_BOOKINGS');
          nextSet.delete('VIEW_BOOKINGS');
          nextSet.delete('MANAGE_PRICING');
          nextSet.delete('MANAGE_INVENTORY');
        }

        if (permission === 'MANAGE_ROOMS' && !nextSet.has('MANAGE_PROPERTY')) {
          nextSet.delete('MANAGE_PRICING');
          nextSet.delete('MANAGE_INVENTORY');
        }
      } else {
        nextSet.add(permission);
      }

      const nextPermissions = applyScopedPermissionInheritance([...nextSet]);

      if (nextPermissions.length === 0) {
        const { [propertyId]: _omit, ...rest } = current;
        return rest;
      }

      return {
        ...current,
        [propertyId]: nextPermissions,
      };
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    const scopedPayload = normalizePropertyPermissions(propertyPermissions);

    const payload = {
      ...form,
      propertyPermissions: scopedPayload,
    };

    if (!payload.password) {
      delete payload.password;
    }

    if (editingUser) {
      await onUpdate(editingUser.id, payload);
    } else {
      await onCreate(payload);
    }

    reset();
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm(buildInitialForm());
    setPropertySearch('');
    setPropertyPermissions({});
    setExpandedProperty(null);
    setOpen(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
    });
    setPropertySearch('');
    setPropertyPermissions(normalizePropertyPermissions(user.propertyPermissions || {}));
    setExpandedProperty(null);
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
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-900">{user.name}</td>
                <td className="px-4 py-3 text-slate-600">{user.email}</td>
                <td className="px-4 py-3 text-slate-600">
                  {(user.managedProperties || []).map((property) => property.name).join(', ') || 'Unassigned'}
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

      <Modal open={open} title={editingUser ? 'Edit manager' : 'Create manager'} onClose={reset} panelClassName="max-w-3xl">
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

          <div className="space-y-3 rounded-2xl border border-slate-200 p-3">
            <p className="text-sm font-semibold text-slate-700">Assign Property</p>
            <p className="text-xs text-slate-500">Property access is granted when at least one permission is selected for that property.</p>

            <input
              value={propertySearch}
              onChange={(event) => setPropertySearch(event.target.value)}
              placeholder="Search property by name"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />

            {filteredProperties.map((property) => (
                <div key={`scoped-${property.id}`} className="rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => toggleExpand(property.id)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-bold text-slate-700">
                      {expandedProperty === property.id ? '-' : '+'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{property.name}</span>
                      {propertyPermissions[property.id]?.length ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Assigned</span>
                      ) : null}
                    </div>
                  </button>

                  {expandedProperty === property.id ? (
                    <div className="space-y-3 border-t border-slate-200 px-3 py-3">
                      <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">{property.name}</p>
                        <p>{property.city && property.state ? `${property.city}, ${property.state}` : property.location}</p>
                        <p className="text-xs text-slate-500">ID: {property.id}</p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        {propertyScopedPermissionOptions.map((option) => (
                          <label
                            key={`${property.id}-${option.key}`}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                              isForcedByParent(propertyPermissions[property.id], option.key)
                                ? 'border-slate-200 bg-slate-100 text-slate-400'
                                : 'border-slate-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(propertyPermissions[property.id]?.includes(option.key))}
                              disabled={isForcedByParent(propertyPermissions[property.id], option.key)}
                              onChange={() => togglePropertyPermission(property.id, option.key)}
                              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400"
                            />
                            <span className="font-medium text-slate-800">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}

            {filteredProperties.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-500">No properties match your search.</p>
            ) : null}
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