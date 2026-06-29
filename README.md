# @codenameryuu/adonis-datatable

Adonis datatable is an inspiration from laravel datatable. It is heavily inspired by the PHP library [Laravel Datatables](https://yajrabox.com/docs/laravel-datatables) and even share some code with services, facade and dependency injection.

## Requirement

* Adonis Js 7
* Lucid 22 or higher
* Jquery datatable

## Installation

* Install the package

```bash
yarn add @codenameryuu/adonis-datatable
```

* Configure the package

```bash
node ace configure @codenameryuu/adonis-datatable
```

* Make sure to register the provider inside `adonisrc.ts` file.

```typescript
providers: [
  // ...
  () => import('@codenameryuu/adonis-datatable/datatables_provider'),
],
```

## Usage

1. Lucid Datatable - Via Service

```typescript
import datatables from '@codenameryuu/adonis-datatable/services/main'
import LucidDataTable from '@codenameryuu/adonis-datatable/engines/lucid_datatable'

import User from '#models/user'

const user = User.query()

const datatable = await datatables
  .of<LucidDataTable>(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

2. Lucid Datatable - Via Factory (Recomended)

```typescript
import { Datatables } from '@codenameryuu/adonis-datatable'

import User from '#models/user'

const user = User.query()

const datatable = await Datatables.lucid(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

3. Lucid Datatable - Via Engine

```typescript
import LucidDataTable from '@codenameryuu/adonis-datatable/engines/lucid_datatable'

import User from '#models/user'

const user = User.query()

const datatable = await new LucidDataTable(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

4. Database Datatable - Via Service

```typescript
import db from '@adonisjs/lucid/services/db'
import datatables from '@codenameryuu/adonis-datatable/services/main'
import DatabaseDataTable from '@codenameryuu/adonis-datatable/engines/database_datatable'

const user = db.from('users').select('*')

const datatable = await datatables
  .of<DatabaseDataTable>(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

5. Database Datatable - Via Factory

```typescript
import db from '@adonisjs/lucid/services/db'
import { Datatables } from '@codenameryuu/adonis-datatable'

const user = db.from('users').select('*')

const datatable = await Datatables.database(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

6. Database Datatable - Via Engine

```typescript
import db from '@adonisjs/lucid/services/db'
import DatabaseDataTable from '@codenameryuu/adonis-datatable/engines/database_datatable'

const user = db.from('users').select('*')

const datatable = await new DatabaseDataTable(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

7. Object Datatable - Via Service

```typescript
import datatables from '@codenameryuu/adonis-datatable/services/main'
import ObjectDataTable from '@codenameryuu/adonis-datatable/engines/object_datatable'

import User from '#models/user'

const user = await User.query()

const datatable = await datatables
  .of<ObjectDataTable>(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

8. Object Datatable - Via Factory

```typescript
import { Datatables } from '@codenameryuu/adonis-datatable'

import User from '#models/user'

const user = await User.query()

const datatable = await Datatables.object(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

9. Object Datatable - Via Engine

```typescript
import ObjectDataTable from '@codenameryuu/adonis-datatable/engines/object_datatable'

import User from '#models/user'

const user = await User.query()

const datatable = await new ObjectDataTable(user)
  .setContext(ctx)
  .addIndexColumn()
  .addColumn('user_full_name', (row) => {
    return row.first_name + ' ' + row.last_name
  })
  .escapeColumns()
  .results()
```

## ColumnControl extension

This package supports the [DataTables ColumnControl](https://datatables.net/extensions/columncontrol/) extension's [server-side processing](https://datatables.net/extensions/columncontrol/server-side) protocol out of the box. No extra configuration is required — when ColumnControl (1.1+) augments the request with its filtering parameters, the matching engine applies them automatically.

The following content types are handled per column:

| Content type     | `type` | Supported logic                                                                 |
| ---------------- | ------ | ------------------------------------------------------------------------------- |
| `searchText` | `text` | `contains` , `notContains` , `equal` , `notEqual` , `starts` , `ends` , `empty` , `notEmpty` |
| `searchNumber` | `num` | `equal` , `notEqual` , `greater` , `greaterOrEqual` , `less` , `lessOrEqual` , `empty` , `notEmpty` |
| `searchDateTime` | `date` | `equal` , `notEqual` , `greater` , `less` , `empty` , `notEmpty` (honours the `mask` option) |
| `searchList` | —      | array of values matched exactly and combined with `OR` |

### Client-side example

```javascript
new DataTable('#example', {
    serverSide: true,
    ajax: '/users/datatable',
    columnControl: [{
            target: 0,
            content: ['order', 'searchText'],
        },
        {
            target: 1,
            content: ['searchList'],
        },
    ],
})
```

### Populating a `searchList`

When using the `searchList` content type, you can send the list of available options back to the client with the `columnControl()` method. The first argument matches (in priority order) the column `name` , the column `data` source, or the column index.

```typescript
const datatable = await Datatables.lucid(User.query())
  .setContext(ctx)
  .columnControl('office', ['Edinburgh', 'Tokyo', 'London'])
  // or with separate label/value pairs (useful with joins):
  .columnControl('office_id', [
    { label: 'Edinburgh', value: 1 },
    { label: 'Tokyo', value: 2 },
  ])
  .results()
```

This adds a top-level `columnControl` object to the JSON response, as expected by the extension.

If you have defined a custom filter for a column with `filterColumn()` , that callback takes precedence and receives the ColumnControl search value as its keyword.

## License

This package is open-sourced software licensed under the [MIT license](LICENSE.md).
