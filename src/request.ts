import type { HttpRequest } from "@adonisjs/core/http";

export default class Request {
  constructor(protected request: HttpRequest) {}

  input(key: string, defaultValue?: any): any {
    const keys = key.split(".");

    const columns: { [key: string]: any } = this.request.input(keys[0]);
    if (!columns) {
      return defaultValue;
    }

    keys.shift();
    const value = keys.reduce((acc, curr) => acc && acc[curr], columns);

    return value;
  }

  columns(): string[] {
    return this.input("columns");
  }

  isSearchable(): boolean {
    return this.input("search.value") !== "";
  }

  isRegex(index: number): boolean {
    return this.input(`columns.${index}.search.regex`) === "true";
  }

  orderableColumns(): Record<string, any>[] {
    if (!this.isOrderable()) {
      return [];
    }

    let orderable: Record<string, any>[] = [];
    for (let i = 0; i < this.input("order").length; i++) {
      const orderColumn: number = this.input(`order.${i}.column`) as unknown as number;

      const direction: string = this.input(`order.${i}.dir`);

      const orderDirection: string = direction && direction.toLowerCase() === "asc" ? "asc" : "desc";
      if (this.isColumnOrderable(orderColumn)) {
        orderable.push({ column: orderColumn, direction: orderDirection });
      }
    }

    return orderable;
  }

  isOrderable(): boolean {
    return this.input("order") && this.input("order").length > 0;
  }

  isColumnOrderable(index: number): boolean {
    return this.input(`columns.${index}.orderable`, "true") === "true";
  }

  searchableColumnIndex(): number[] {
    const searchable: number[] = [];
    const columns: object[] = this.input("columns");
    for (let index = 0; index < columns.length; index++) {
      if (this.isColumnSearchable(index, false)) {
        searchable.push(index);
      }
    }
    return searchable;
  }

  isColumnSearchable(index: number, columnSearch = true): boolean {
    if (columnSearch) {
      return (
        (this.input(`columns.${index}.searchable`, "true") === "true" ||
          (this.input(`columns.${index}.searchable`, "true") as unknown as boolean) === true) &&
        this.columnKeyword(index) !== ""
      );
    }

    return (
      this.input(`columns.${index}.searchable`, "true") === "true" ||
      (this.input(`columns.${index}.searchable`, "true") as unknown as boolean) === true
    );
  }

  columnKeyword(index: number): string {
    const keyword: string = this.input(`columns.${index}.search.value`) ?? "";

    return this.prepareKeyword(keyword);
  }

  prepareKeyword(keyword: number | string | string[]): string {
    if (Array.isArray(keyword)) {
      keyword = keyword as string[];
      return keyword.join(" ");
    }

    return keyword as string;
  }

  keyword(): string {
    const keyword: string = this.input("search.value") ?? "";

    return this.prepareKeyword(keyword);
  }

  columnName(index: number): string | undefined {
    const column: { [key: string]: string } | undefined = this.input(`columns.${index}`);

    return column && column["name"] && column["name"] !== "" ? column["name"] : column?.["data"];
  }

  /**
   * Determine whether the column has any active ColumnControl search payload.
   *
   * @see https://datatables.net/extensions/columncontrol/server-side
   */
  hasColumnControl(index: number): boolean {
    const columnControl = this.input(`columns.${index}.columnControl`);
    if (!columnControl) {
      return false;
    }

    const value = this.input(`columns.${index}.columnControl.search.value`);
    const logic: string | undefined = this.input(`columns.${index}.columnControl.search.logic`);

    return (
      (value !== undefined && value !== null && value !== "") ||
      logic === "empty" ||
      logic === "notEmpty" ||
      this.hasColumnControlList(index)
    );
  }

  /**
   * The input based search payload (searchText, searchNumber, searchDateTime).
   */
  columnControlSearch(index: number): { value: string; logic: string; type: string; mask?: string } | null {
    const search: Record<string, any> | undefined = this.input(`columns.${index}.columnControl.search`);
    if (!search) {
      return null;
    }

    return {
      value: this.prepareKeyword(search["value"] ?? ""),
      logic: search["logic"] ?? "contains",
      type: search["type"] ?? "text",
      mask: search["mask"],
    };
  }

  /**
   * The list of selected values used by the searchList content type.
   */
  columnControlList(index: number): any[] {
    const list: any = this.input(`columns.${index}.columnControl.list`);

    if (Array.isArray(list)) {
      return list;
    }

    if (list && typeof list === "object") {
      return Object.values(list);
    }

    return [];
  }

  hasColumnControlList(index: number): boolean {
    return this.columnControlList(index).length > 0;
  }

  isPaginationable(): boolean {
    return this.input("start") !== null && this.input("length") !== null && this.input("length") !== -1;
  }

  start(): number {
    const start: any = this.input("start", 0);

    return Number(start) ? (start as number) : 0;
  }

  length(): number {
    const length: any = this.input("length", 0);

    return Number(length) ? (length as number) : 10;
  }

  draw(): number {
    const draw: any = this.input("draw", 0);

    return Number(draw) ? (draw as number) : 0;
  }

  all() {
    return this.request.all();
  }
}
