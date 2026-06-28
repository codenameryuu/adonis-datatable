import collect, { Collection } from "collect.js";
import lodash from "lodash";
import { DataTableAbstract } from "../datatable_abstract.js";
import Helper from "../utils/helper.js";

export default class ObjectDataTable extends DataTableAbstract {
  protected $offset: number = 0;

  constructor(protected items: Record<string, any>[]) {
    super();
    this.$columns = collect(this.items).keys();
  }

  static canCreate(source: any): boolean {
    return typeof source === "object" || source instanceof Collection;
  }

  protected resolveCallback() {
    return this;
  }

  protected defaultOrdering(): any {
    const self = this;
    const orderable = this.request.orderableColumns();

    if (orderable.length) {
      this.items = collect(this.items)
        .map((data) => Helper.dot(data))
        .sort((a: Record<string, any>, b: Record<string, any>) => {
          for (const value of Object.values(orderable)) {
            const column = self.getColumnName(value["column"]) as string;
            const direction = value["direction"];
            let first: Record<string, any>;
            let second: Record<string, any>;
            let cmp: number = 0;

            if (direction === "desc") {
              first = b;
              second = a;
            } else {
              first = a;
              second = b;
            }
            if (Number.isInteger(first[column] ?? null) && Number.isInteger(second[column] ?? null)) {
              if (first[column] < second[column]) {
                cmp = -1;
              } else if (first[column] > second[column]) {
                cmp = 1;
              }
            } else if (self.config.isCaseInsensitive()) {
              const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
              cmp = collator.compare(first[column], second[column]);
            } else {
              const collator = new Intl.Collator(undefined, {
                sensitivity: "variant",
                numeric: true,
              });
              cmp = collator.compare(first[column], second[column]);
            }

            return cmp;
          }
          return 0;
        })
        .map((data) => {
          for (const [index, value] of Object.entries(data)) {
            lodash.unset(data, index);
            lodash.set(data, index, value);
          }

          return data;
        })
        .all();
    }
  }

  protected revertIndexColumn(): void {
    if (this.$columnDef["index"]) {
      const indexColumn = this.config.get("datatables.index_column", "DT_RowIndex");
      const index = this.$dataObject ? indexColumn : 0;
      let start = this.request.start();

      collect(this.items).transform((data) => {
        data[index] = ++start;

        return data;
      });
    }
  }

  async count(): Promise<number> {
    return collect(this.items).count();
  }

  async results(): Promise<Record<string, any> | void> {
    try {
      this.prepareContext();

      this.totalRecords = await this.totalCount();

      if (this.totalRecords) {
        const results = this.dataResults();
        const processed = this.processResults(results);
        const output = lodash.transform(processed, (result: Record<string, any>, value: any, key: string) => {
          if (value) {
            result[key] = value;
          }
        });

        this.items = collect(output).all();
        this.ordering();
        await this.filterRecords();
        this.paginate();

        this.revertIndexColumn();
      }

      return this.render(collect(this.items).all());
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  dataResults(): any {
    return collect(this.items).all();
  }

  setOffset(offset: number): this {
    this.$offset = offset;

    return this;
  }

  columnSearch(): void {
    const self = this;
    for (let i = 0, c = this.request.columns().length; i < c; i++) {
      const column = this.getColumnName(i);

      if (column === null) {
        continue;
      }

      if (this.isBlacklisted(column)) {
        continue;
      }

      if (this.request.hasColumnControl(i) && this.request.isColumnSearchable(i, false)) {
        this.applyColumnControlSearch(i, column);
        continue;
      }

      if (!this.request.isColumnSearchable(i)) {
        continue;
      }

      const regex = this.request.isRegex(i);
      const keyword = this.request.columnKeyword(i);

      this.items = collect(this.items)
        .filter((row: Record<string, any>) => {
          const value = lodash.get(row, column);

          if (self.config.isCaseInsensitive()) {
            if (regex) {
              return new RegExp(keyword, "i").test(value);
            }

            return Helper.contains(value.toLowerCase(), keyword.toLowerCase());
          }

          if (regex) {
            return new RegExp(keyword).test(value);
          }

          return Helper.contains(value, keyword);
        })
        .all();
    }
  }

  /**
   * Apply the search conditions sent by the DataTables ColumnControl extension.
   *
   * @see https://datatables.net/extensions/columncontrol/server-side
   */
  protected applyColumnControlSearch(index: number, column: string): void {
    const self = this;

    if (this.request.hasColumnControlList(index)) {
      const list = this.request.columnControlList(index).map((value) => self.normalizeColumnControl(value));

      this.items = collect(this.items)
        .filter((row: Record<string, any>) => list.includes(self.normalizeColumnControl(lodash.get(row, column))))
        .all();
    }

    const search = this.request.columnControlSearch(index);
    if (search && (search.value !== "" || search.logic === "empty" || search.logic === "notEmpty")) {
      this.items = collect(this.items)
        .filter((row: Record<string, any>) => self.matchColumnControl(lodash.get(row, column), search))
        .all();
    }
  }

  protected normalizeColumnControl(value: any): string {
    const text = value === null || value === undefined ? "" : String(value);

    return this.config.isCaseInsensitive() ? text.toLowerCase() : text;
  }

  protected matchColumnControl(raw: any, search: { value: string; logic: string; type: string; mask?: string }): boolean {
    const logic = search.logic;
    const isEmpty = raw === null || raw === undefined || String(raw) === "";

    if (logic === "empty") {
      return isEmpty;
    }

    if (logic === "notEmpty") {
      return !isEmpty;
    }

    if (search.type === "num") {
      const left = Number(raw);
      const right = Number(search.value);

      if (Number.isNaN(left) || Number.isNaN(right)) {
        return false;
      }

      switch (logic) {
        case "notEqual":
          return left !== right;
        case "greater":
          return left > right;
        case "greaterOrEqual":
          return left >= right;
        case "less":
          return left < right;
        case "lessOrEqual":
          return left <= right;
        case "equal":
        default:
          return left === right;
      }
    }

    if (search.type === "date") {
      const dateOnly = !!search.mask && !/[Hhms]/.test(search.mask);
      const left = this.toTimestamp(raw, dateOnly);
      const right = this.toTimestamp(search.value, dateOnly);

      if (Number.isNaN(left) || Number.isNaN(right)) {
        return false;
      }

      switch (logic) {
        case "notEqual":
          return left !== right;
        case "greater":
          return left > right;
        case "less":
          return left < right;
        case "equal":
        default:
          return left === right;
      }
    }

    const haystack = this.normalizeColumnControl(raw);
    const needle = this.normalizeColumnControl(search.value);

    switch (logic) {
      case "equal":
        return haystack === needle;
      case "notEqual":
        return haystack !== needle;
      case "starts":
        return haystack.startsWith(needle);
      case "ends":
        return haystack.endsWith(needle);
      case "notContains":
        return !haystack.includes(needle);
      case "contains":
      default:
        return haystack.includes(needle);
    }
  }

  protected toTimestamp(value: any, dateOnly: boolean): number {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return Number.NaN;
    }

    if (dateOnly) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    }

    return date.getTime();
  }

  paging(): void {
    const offset = this.request.start() - this.$offset;
    const length = this.request.length() > 0 ? this.request.length() : 10;

    this.items = collect(this.items).slice(offset, length).all();
  }

  globalSearch(keyword: string): void {
    keyword = this.config.isCaseInsensitive() ? keyword.toLowerCase() : keyword;

    this.items = collect(this.items)
      .filter((row: any) => {
        for (const index of Object.values(this.request.searchableColumnIndex())) {
          const column = this.getColumnName(index) as string;
          let value = lodash.get(row, column);
          if (typeof value !== "string") {
            continue;
          } else {
            value = this.config.isCaseInsensitive() ? value.toLowerCase() : value;
          }

          if (Helper.contains(value, keyword)) {
            return true;
          }
        }

        return false;
      })
      .all();
  }
}
