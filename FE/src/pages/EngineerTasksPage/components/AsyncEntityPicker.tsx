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
  inputClassName?: string;
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
  inputClassName,
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
      const baseOptions = search.trim()
        ? selectedOption
          ? [selectedOption]
          : []
        : [...(selectedOption ? [selectedOption] : []), ...initialOptions];
      setOptions(mergePickerOptions([...baseOptions, ...nextOptions]));
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

  const rootClass = [
    'grid min-w-0 content-start gap-2 font-sans text-sm font-semibold leading-snug text-[#333333]',
    className,
  ].filter(Boolean).join(' ');
  const inputClass = inputClassName ||
    'h-12 w-full min-w-0 rounded-2xl border border-[#ded8d8] bg-white px-4 text-sm font-semibold text-[#1f1f1f] outline-none transition focus:border-[#18181b] focus:bg-white focus:shadow-[0_0_0_4px_rgba(24,24,27,0.12)] disabled:bg-[#f3f6f9] disabled:text-[#666666]';

  return (
    <div className={rootClass}>
      <span>{label}</span>
      <div className="relative min-w-0">
        <input
          className={inputClass}
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
        {required && !value ? <input className="pointer-events-none absolute h-px w-px opacity-0" required value="" onChange={() => null} /> : null}
        {open ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-50 grid max-h-72 overflow-y-auto rounded-2xl border border-[#ded8d8] bg-white p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.16)]">
            {loading ? <div className="p-3 text-sm font-semibold text-[#667085]">Đang tìm...</div> : null}
            {!loading && options.length === 0 ? <div className="p-3 text-sm font-semibold text-[#667085]">Không tìm thấy dữ liệu phù hợp.</div> : null}
            {!loading
              ? options.map((option) => (
                  <button
                    className={[
                      'w-full rounded-xl border-0 bg-transparent px-3 py-3 text-left text-sm font-semibold text-[#1f1f1f] hover:bg-[#f4f7fb]',
                      option.value === value ? 'bg-[#f4f7fb]' : '',
                    ].filter(Boolean).join(' ')}
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
