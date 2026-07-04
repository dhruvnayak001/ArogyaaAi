/**
 * components/ui/StatusBadge.jsx
 * Semantic status badge for appointments, records, etc.
 */

import React from 'react';
import { clsx } from 'clsx';

const STATUS_MAP = {
  /* Appointments */
  pending:    { label: 'Pending',    cls: 'badge-warning' },
  confirmed:  { label: 'Confirmed',  cls: 'badge-success' },
  completed:  { label: 'Completed',  cls: 'badge-primary' },
  cancelled:  { label: 'Cancelled',  cls: 'badge-danger'  },
  /* Records */
  lab_report:        { label: 'Lab Report',        cls: 'badge-primary'  },
  prescription:      { label: 'Prescription',      cls: 'badge-accent'   },
  scan:              { label: 'Scan',               cls: 'badge-warning'  },
  discharge_summary: { label: 'Discharge Summary',  cls: 'badge-danger'   },
  vaccination:       { label: 'Vaccination',         cls: 'badge-success'  },
  allergy_report:    { label: 'Allergy Report',      cls: 'badge-warning'  },
  other:             { label: 'Other',               cls: 'badge-primary'  },
  /* Appointment types */
  'in-person': { label: 'In-Person', cls: 'badge-success' },
  video:       { label: 'Video',     cls: 'badge-accent'  },
  phone:       { label: 'Phone',     cls: 'badge-primary' },
};

function StatusBadge({ status, className }) {
  const config = STATUS_MAP[status] ?? { label: status, cls: 'badge-primary' };
  return (
    <span className={clsx(config.cls, className)}>
      {config.label}
    </span>
  );
}

export default StatusBadge;
