const permissionFields = [
  {
    key: 'canManageProperties',
    label: 'Edit property information',
    description: 'Update property details like name, location, description, and related metadata.',
  },
  {
    key: 'canManageRooms',
    label: 'Manage rooms',
    description: 'Add, edit, or remove room types.',
  },
  {
    key: 'canManagePricing',
    label: 'Manage pricing',
    description: 'Edit nightly rates and pricing rules.',
  },
  {
    key: 'canManageInventory',
    label: 'Manage inventory',
    description: 'Adjust availability in the calendar grid.',
  },
  {
    key: 'manage_bookings',
    label: 'Can manage bookings',
    description: 'View bookings, create manual bookings, and update or cancel booking records.',
  },
];

const applyPermissionInheritance = (permissions, key, checked) => {
  const nextPermissions = { ...permissions, [key]: checked };

  if (key === 'canManageProperties' && checked) {
    nextPermissions.canManageRooms = true;
    nextPermissions.canManagePricing = true;
    nextPermissions.canManageInventory = true;
  }

  if (key === 'canManageRooms' && checked) {
    nextPermissions.canManagePricing = true;
    nextPermissions.canManageInventory = true;
  }

  return nextPermissions;
};

const isForcedByParent = (permissions, key) => {
  if (key === 'canManageRooms') {
    return Boolean(permissions?.canManageProperties);
  }

  if (key === 'canManagePricing' || key === 'canManageInventory') {
    return Boolean(permissions?.canManageProperties || permissions?.canManageRooms);
  }

  return false;
};

function PermissionEditor({ value, onChange }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-700">Permissions</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {permissionFields.map((field) => (
          <label
            key={field.key}
            className={`rounded-2xl border p-3 text-sm ${
              isForcedByParent(value, field.key) ? 'border-slate-200 bg-slate-100 text-slate-400' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={Boolean(value?.[field.key])}
                disabled={isForcedByParent(value, field.key)}
                onChange={(event) => onChange(applyPermissionInheritance(value || {}, field.key, event.target.checked))}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400"
              />
              <div>
                <p className={`font-semibold ${isForcedByParent(value, field.key) ? 'text-slate-500' : 'text-slate-900'}`}>
                  {field.label}
                </p>
                <p className={`text-xs ${isForcedByParent(value, field.key) ? 'text-slate-400' : 'text-slate-500'}`}>
                  {field.description}
                </p>
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export default PermissionEditor;