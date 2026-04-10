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
];

function PermissionEditor({ value, onChange }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-slate-700">Permissions</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {permissionFields.map((field) => (
          <label key={field.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={Boolean(value?.[field.key])}
                onChange={(event) => onChange({ ...value, [field.key]: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <div>
                <p className="font-semibold text-slate-900">{field.label}</p>
                <p className="text-xs text-slate-500">{field.description}</p>
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export default PermissionEditor;