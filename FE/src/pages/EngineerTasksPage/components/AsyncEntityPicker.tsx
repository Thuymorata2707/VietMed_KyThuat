import { useEffect, useState } from 'react';
import { Paginated, apiFetch } from '../../../api';
import type { SelectOption } from '../types';

export type PickerOption<Row> = SelectOption & {
  row: Row;
};

type AsyncEntityPickerProps<Row extends { id: string }> = {
  className?: string;
  disabled?: boolean;
  endpoint: string;
  formatOption: (row: Row) => PickerOption<Row>;
  initialOptions: Array<PickerOption<Row>>;
  label: string;
  onChange: (value: string, row?: Row) => void;
  placeholder: string;
  required?: boolean;
  rowFilter?: (row: Row) => boolean;
  value: string;
};

export function AsyncEntityPicker<Row extends { id: string }>({
  className,
  disabled,
  endpoint,
  formatOption,
  initialOptions,
  label,
  onChange,
  placeholder,
  required,
  rowFilter,
  value,
}: AsyncEntityPickerProps<Row>) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<Array<PickerOption<Row>>>(initialOptions);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const selectedOption = options.find((option) => option.value === value) || initialOptions.find((option) => option.value === value);

  useEffect(() => {
    setOptions((current) => {
      const merged = mergePickerOptions([...current, ...initialOptions]);
      const isSame =
        merged.length === current.length &&
        merged.every((option, index) => option.value === current[index]?.value && option.label === current[index]?.label);
      return isSame ? current : merged;
    });
  }, [initialOptions]);

  useEffect(() => {
    if (!open || disabled) return;

    const timeout = window.setTimeout(() => {
      void loadOptions();
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [open, search, endpoint, disabled]);

  async function loadOptions() {
    setLoading(true);

    try {
      const result = await apiFetch<Paginated<Row>>(
        withSearchParams(endpoint, {
          limit: '20',
          search: search.trim(),
        }),
      );
      const nextOptions = result.data
        .filter((row) => (rowFilter ? rowFilter(row) : true))
        .map(formatOption);
      setOptions(mergePickerOptions([...(selectedOption ? [selectedOption] : []), ...initialOptions, ...nextOptions]));
    } catch {
      setOptions((current) => current);
    } finally {
      setLoading(false);
    }
  }

  function choose(option: PickerOption<Row>) {
    onChange(option.value, option.row);
    setSearch(option.label);
    setOpen(false);
  }

  const inputValue = open ? search : selectedOption?.label || '';

  return (
    <div className={['async-entity-picker', className].filter(Boolean).join(' ')}>
      <span>{label}</span>
      <div className="async-picker-control">
        <input
          disabled={disabled}
          onBlur={() => {
            window.setTimeout(() => {
              setSearch('');
              setOpen(false);
            }, 160);
          }}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setSearch('');
            setOpen(true);
          }}
          placeholder={placeholder}
          value={inputValue}
        />
        {required && !value ? <input className="async-picker-required" required value="" onChange={() => null} /> : null}
        {open ? (
          <div className="async-picker-menu">
            {loading ? <div className="async-picker-state">Đang tìm...</div> : null}
            {!loading && options.length === 0 ? <div className="async-picker-state">Không tìm thấy dữ liệu phù hợp.</div> : null}
            {!loading
              ? options.map((option) => (
                  <button
                    className={option.value === value ? 'active' : ''}
                    key={option.value}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(option)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))
              : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function mergePickerOptions<Row>(options: Array<PickerOption<Row>>) {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (!option.value || seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function withSearchParams(endpoint: string, params: Record<string, string>) {
  const [path, query = ''] = endpoint.split('?');
  const searchParams = new URLSearchParams(query);

  Object.entries(params).forEach(([key, paramValue]) => {
    if (paramValue) {
      searchParams.set(key, paramValue);
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}
