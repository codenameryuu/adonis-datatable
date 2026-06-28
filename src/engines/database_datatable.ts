import { DataTableAbstract } from "../datatable_abstract.js";
import { DatabaseQueryBuilder } from "@adonisjs/lucid/database";
import Helper from "../utils/helper.js";
import type { DatabaseQueryBuilderContract, Dictionary } from "@adonisjs/lucid/types/querybuilder";
import type { LucidModel, ModelQueryBuilderContract } from "@adonisjs/lucid/types/model";
import lodash from "lodash";
import collect from "collect.js";
import { sprintf } from "sprintf-js";

export default class DatabaseDataTable extends DataTableAbstract {
  protected nullsLast: boolean = false;

  protected prepared: boolean = false;

  protected keepSelectBindings: boolean = false;

  protected disableUserOrdering: boolean = false;

  constructor(protected query: DatabaseQueryBuilderContract<Dictionary<any, string>> | ModelQueryBuilderContract<LucidModel, any>) {
    super();
    this.$columns = query.columns;
  }

  static canCreate(source: any): boolean {
    return source instanceof DatabaseQueryBuilder;
  }

  protected getConnection() {
    return this.query.knexQuery.client;
  }

  protected defaultOrdering(): any {
    const self = this;
    collect(this.request.orderableColumns())
      .map((orderable: Record<string, any>) => {
        orderable["name"] = self.getColumnName(orderable["column"], true);

        return orderable;
      })
      .reject((orderable: Record<string, any>) => self.isBlacklisted(orderable["name"]) && !self.hasOrderColumn(orderable["name"]))
      .each((orderable: Record<string, any>) => {
        const column = self.resolveRelationColumn(orderable["name"]);

        if (self.hasOrderColumn(orderable["name"])) {
          self.applyOrderColumn(orderable["name"], orderable);
        } else if (self.hasOrderColumn(column)) {
          self.applyOrderColumn(column, orderable);
        } else {
          const nullsLastSql = self.getNullsLastSql(column, orderable["direction"]);
          const normalSql = self.wrapColumn(column) + " " + orderable["direction"];
          const sql = self.nullsLast ? nullsLastSql : normalSql;
          self.query.orderByRaw(sql);
        }
      });
  }

  protected hasOrderColumn(column: string): boolean {
    return this.$columnDef["order"][column] !== undefined;
  }

  protected applyOrderColumn(column: string, orderable: Record<string, any>): void {
    let sql = this.$columnDef["order"][column]["sql"];
    if (sql === false) {
      return;
    }

    if (typeof sql === "function") {
      sql(this.query, orderable["direction"]);
    } else {
      sql = sql.replace("$1", orderable["direction"]);
      const bindings = this.$columnDef["order"][column]["bindings"];
      this.query.orderByRaw(sql, bindings);
    }
  }

  protected getNullsLastSql(column: string, direction: string): string {
    const sql = this.config.get("datatables.nulls_last_sql", "%s %s NULLS LAST");

    return sprintf(sql, column, direction).replace(":column", column).replace(":direction", direction);
  }

  protected attachAppends(data: Record<string, any>): Record<string, any> {
    const appends: Record<string, any> = {};
    for (const [key, value] of Object.entries(this.appends)) {
      if (typeof value === "function") {
        appends[key] = Helper.value(value(this.getFilteredQuery()));
      } else {
        appends[key] = value;
      }
    }

    appends["disableOrdering"] = this.disableUserOrdering;

    return { ...data, ...appends };
  }

  protected getColumnSearchKeyword(i: number, raw: boolean = false): string {
    const keyword = this.request.columnKeyword(i);
    if (raw || this.request.isRegex(i)) {
      return keyword;
    }

    return this.setupKeyword(keyword);
  }

  protected applyFilterColumn(
    query: DatabaseQueryBuilderContract<Dictionary<any, string>> | ModelQueryBuilderContract<LucidModel, any>,
    columnName: string,
    keyword: string
  ): void {
    query = this.getBaseQueryBuilder(query);
    const callback = this.$columnDef["filter"][columnName]["method"];

    callback(query, keyword);
  }

  protected resolveRelationColumn(column: string): string {
    return column;
  }

  protected compileColumnSearch(i: number, column: string, keyword: string): void {
    if (this.request.isRegex(i)) {
      this.regexColumnSearch(column, keyword);
    } else {
      this.compileQuerySearch(this.query, column, keyword, "");
    }
  }

  protected regexColumnSearch(column: string, keyword: string): void {
    column = this.wrapColumn(column);

    let sql: string = "";
    switch (this.getConnection().driverName) {
      case "oracle":
        sql = !this.config.isCaseInsensitive() ? "REGEXP_LIKE( " + column + " , ? )" : "REGEXP_LIKE( LOWER(" + column + ") , ?, 'i' )";
        break;

      case "pgsql":
        column = this.castColumn(column);
        sql = !this.config.isCaseInsensitive() ? column + " ~ ?" : column + " ~* ? ";
        break;

      default:
        sql = !this.config.isCaseInsensitive() ? column + " REGEXP ?" : "LOWER(" + column + ") REGEXP ?";
        keyword = keyword.toLowerCase();
    }

    this.query.whereRaw(sql, [keyword]);
  }

  protected compileQuerySearch(
    query: ModelQueryBuilderContract<LucidModel, any> | DatabaseQueryBuilderContract<Dictionary<any, string>>,
    columnName: string,
    keyword: string,
    boolean: string = "or"
  ): void {
    let column = this.addTablePrefix(query, columnName);
    column = this.castColumn(column);
    let sql = column + " LIKE ?";

    if (this.config.isCaseInsensitive()) {
      sql = "LOWER(" + column + ") LIKE ?";
    }
    const method: string = lodash.lowerFirst(`${boolean}WhereRaw`);
    (query as any)[method](sql, [this.prepareKeyword(keyword)]);
  }

  protected prepareKeyword(keyword: string): string {
    if (this.config.isCaseInsensitive()) {
      keyword = keyword.toLowerCase();
    }

    if (this.config.isStartsWithSearch()) {
      return `${keyword}%`;
    }

    if (this.config.isWildcard()) {
      keyword = Helper.wildcardString(keyword, "%");
    }

    if (this.config.isSmartSearch()) {
      keyword = `%${keyword}%`;
    }

    return keyword;
  }

  protected async prepareQuery(): Promise<this> {
    if (!this.prepared) {
      this.totalRecords = await this.totalCount();

      await this.filterRecords();
      this.ordering();
      this.paginate();
    }

    this.prepared = true;

    return this;
  }

  protected async filterRecords(): Promise<void> {
    const initialQuery = this.query.clone();

    if (this.autoFilter && this.request.isSearchable()) {
      this.filtering();
    }

    if (typeof this.filterCallback === "function") {
      this.filterCallback(this.query);
    }

    this.columnSearch();

    if (!this.$skipTotalRecords && this.query === initialQuery) {
      this.filteredRecords ??= this.totalRecords;
    } else {
      await this.filteredCount();

      if (this.$skipTotalRecords) {
        this.totalRecords = this.filteredRecords;
      }
    }
  }

  protected hasFilterColumn(columnName: string): boolean {
    return this.$columnDef["filter"][columnName] !== undefined;
  }

  protected wrapColumn(column: string) {
    return Helper.wrapColumn(column, true);
  }

  protected getBaseQueryBuilder(
    instance: DatabaseQueryBuilderContract<Dictionary<any, string>> | ModelQueryBuilderContract<LucidModel, any> | undefined = undefined
  ): DatabaseQueryBuilderContract<Dictionary<any, string>> | ModelQueryBuilderContract<LucidModel, any> {
    if (!instance) {
      instance = this.query as DatabaseQueryBuilderContract<Dictionary<any, string>> | ModelQueryBuilderContract<LucidModel, any>;
    }

    return instance;
  }

  protected castColumn(column: string): string {
    const driverName = this.getConnection().driverName;

    switch (driverName) {
      case "pgsql":
        return `CAST(${column} AS TEXT)`;
      case "firebird":
        return `CAST(${column} AS VARCHAR(255))`;
      default:
        return column;
    }
  }

  protected addTablePrefix(
    query: DatabaseQueryBuilderContract<Dictionary<any, string>> | ModelQueryBuilderContract<LucidModel, any>,
    column: string
  ): string {
    if (!column.includes(".")) {
      const sql = this.getBaseQueryBuilder(query).toSQL().sql;
      const tableName = sql.match(/from\s+`?(\w+)`?/i)?.[1] || "";
      let from: string = tableName;

      if (typeof from === "string") {
        if (from.includes(" as ")) {
          from = from.split(" as ")[1] as string;
        }
        column = `${from}.${column}`;
      }
    }

    return this.wrapColumn(column);
  }

  protected getFilteredQuery(): DatabaseQueryBuilderContract<Dictionary<any, string>> | ModelQueryBuilderContract<LucidModel, any> {
    this.prepareQuery();

    return this.query;
  }

  protected resolveCallback(): any {
    return this.query;
  }

  async results() {
    try {
      this.prepareContext();

      const query = await this.prepareQuery();
      const results = await query.dataResults();
      const processed = this.processResults(results);

      return this.render(processed);
    } catch (error) {
      return this.errorResponse(error);
    }
  }

  async dataResults(): Promise<Record<string, any>[]> {
    return await this.query;
  }

  async count(): Promise<number> {
    const builder = this.query.clone() as DatabaseQueryBuilder;
    const result = await builder.exec();
    return result.length;
  }

  columnSearch(): void {
    const columns = this.request.columns();

    for (let index = 0; index < columns.length; index++) {
      let column = this.getColumnName(index);

      if (column === null) {
        continue;
      }

      if (this.isBlacklisted(column) && !this.hasFilterColumn(column)) {
        continue;
      }

      if (this.request.hasColumnControl(index) && this.request.isColumnSearchable(index, false)) {
        this.applyColumnControlSearch(index, column);
        continue;
      }

      if (!this.request.isColumnSearchable(index)) {
        continue;
      }

      if (this.hasFilterColumn(column)) {
        const keyword = this.getColumnSearchKeyword(index, true);
        this.applyFilterColumn(this.getBaseQueryBuilder(), column, keyword);
      } else {
        column = this.resolveRelationColumn(column);
        const keyword = this.getColumnSearchKeyword(index);
        this.compileColumnSearch(index, column, keyword);
      }
    }
  }

  /**
   * Apply the search conditions sent by the DataTables ColumnControl extension.
   *
   * @see https://datatables.net/extensions/columncontrol/server-side
   */
  protected applyColumnControlSearch(index: number, column: string): void {
    if (this.request.hasColumnControlList(index)) {
      this.applyColumnControlList(column, this.request.columnControlList(index));
    }

    const search = this.request.columnControlSearch(index);
    if (search && (search.value !== "" || search.logic === "empty" || search.logic === "notEmpty")) {
      if (this.hasFilterColumn(column)) {
        this.applyFilterColumn(this.getBaseQueryBuilder(), column, search.value);
      } else {
        this.compileColumnControlSearch(this.resolveRelationColumn(column), search);
      }
    }
  }

  protected applyColumnControlList(column: string, list: any[]): void {
    const self = this;
    const resolved = this.resolveRelationColumn(column);

    this.query.where((query: any) => {
      for (const value of list) {
        self.compileExactMatch(query, resolved, String(value), "or");
      }
    });
  }

  protected compileExactMatch(
    query: ModelQueryBuilderContract<LucidModel, any> | DatabaseQueryBuilderContract<Dictionary<any, string>>,
    columnName: string,
    value: string,
    boolean: string = "or"
  ): void {
    let column = this.castColumn(this.addTablePrefix(query, columnName));
    let keyword = value;

    if (this.config.isCaseInsensitive()) {
      column = `LOWER(${column})`;
      keyword = keyword.toLowerCase();
    }

    const method: string = lodash.lowerFirst(`${boolean}WhereRaw`);
    (query as any)[method](`${column} = ?`, [keyword]);
  }

  protected compileColumnControlSearch(column: string, search: { value: string; logic: string; type: string; mask?: string }): void {
    const wrapped = this.addTablePrefix(this.query, column);
    const logic = search.logic;

    if (logic === "empty") {
      this.query.whereRaw(`(${wrapped} IS NULL OR ${wrapped} = ?)`, [""]);
      return;
    }

    if (logic === "notEmpty") {
      this.query.whereRaw(`(${wrapped} IS NOT NULL AND ${wrapped} != ?)`, [""]);
      return;
    }

    switch (search.type) {
      case "num":
        this.compileNumberSearch(wrapped, logic, search.value);
        break;

      case "date":
        this.compileDateSearch(wrapped, logic, search.value, search.mask);
        break;

      default:
        this.compileTextSearch(wrapped, logic, search.value);
    }
  }

  protected compileTextSearch(column: string, logic: string, value: string): void {
    let target = this.castColumn(column);
    let keyword = value;

    if (this.config.isCaseInsensitive()) {
      target = `LOWER(${target})`;
      keyword = keyword.toLowerCase();
    }

    switch (logic) {
      case "equal":
        this.query.whereRaw(`${target} = ?`, [keyword]);
        break;
      case "notEqual":
        this.query.whereRaw(`${target} != ?`, [keyword]);
        break;
      case "starts":
        this.query.whereRaw(`${target} LIKE ?`, [`${keyword}%`]);
        break;
      case "ends":
        this.query.whereRaw(`${target} LIKE ?`, [`%${keyword}`]);
        break;
      case "notContains":
        this.query.whereRaw(`${target} NOT LIKE ?`, [`%${keyword}%`]);
        break;
      case "contains":
      default:
        this.query.whereRaw(`${target} LIKE ?`, [`%${keyword}%`]);
    }
  }

  protected compileNumberSearch(column: string, logic: string, value: string): void {
    const operators: Record<string, string> = {
      equal: "=",
      notEqual: "!=",
      greater: ">",
      greaterOrEqual: ">=",
      less: "<",
      lessOrEqual: "<=",
    };

    const operator = operators[logic] ?? "=";
    this.query.whereRaw(`${column} ${operator} ?`, [Number(value)]);
  }

  protected compileDateSearch(column: string, logic: string, value: string, mask?: string): void {
    let target = column;

    if (mask && !/[Hhms]/.test(mask)) {
      target = `DATE(${column})`;
    }

    const operators: Record<string, string> = {
      equal: "=",
      notEqual: "!=",
      greater: ">",
      less: "<",
    };

    const operator = operators[logic] ?? "=";
    this.query.whereRaw(`${target} ${operator} ?`, [value]);
  }

  filterColumn(column: string, callback: <T extends abstract new (...args: any) => any>(query: InstanceType<T>, keyword: string) => void): this {
    this.$columnDef["filter"][column] = { method: callback };

    return this;
  }

  orderColumns(columns: Record<string, any>, sql: string, bindings: any[] = []): this {
    for (const column of Object.values(columns)) {
      this.orderColumn(column, sql.replace(":column", column), bindings);
    }

    return this;
  }

  orderColumn(
    column: string,
    sql: (<T extends abstract new (...args: any) => any>(query: InstanceType<T>, direction: string) => void) | string | boolean,
    bindings: any[] = []
  ): this {
    this.$columnDef["order"][column] = { sql: sql, bindings: bindings };

    return this;
  }

  orderByNullsLast(): this {
    this.nullsLast = true;

    return this;
  }

  paging(): void {
    const start = this.request.start();
    const length = this.request.length();
    const limit = length > 0 ? length : 10;

    this.query.offset(start).limit(limit);
  }

  addColumn(
    name: string,
    content: (<T extends abstract new (...args: any) => any>(row: InstanceType<T>) => string | number) | string | number,
    order = false
  ): this {
    this.pushToBlacklist(name);

    return super.addColumn(name, content, order);
  }

  globalSearch(keyword: string): void {
    const self = this;

    this.query.where((query: DatabaseQueryBuilder) => {
      collect(self.request.searchableColumnIndex())
        .map((index: number) => super.getColumnName(index))
        .filter(() => true)
        .reject((column) => self.isBlacklisted(column as string) && !self.hasFilterColumn(column as string))
        .each((column) => {
          if (self.hasFilterColumn(column as string)) {
            self.applyFilterColumn(query, column as string, keyword);
          } else {
            self.compileQuerySearch(query, column as string, keyword);
          }
        });
    });
  }

  ordering(): void {
    if (this.disableUserOrdering) {
      return;
    }

    super.ordering();
  }
}
