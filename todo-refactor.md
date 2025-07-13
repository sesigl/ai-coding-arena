refactor: do not use pure types, why would you? Always prefer classes, interfaces and others over types becaues I want to have rich classes with methods and properties following DDD principles.

refactor: update all packes to its newest versin so we are up2date

refactor: put tests next to their classes to make them more discoverable and easier to maintain

refactor: configure typescript to use a base path from /src , do not use relative paths anymore. update all classes and ensure consistency.

refactor: extract custom test assertions to reduce duplication and improve readability

refactor: pin all npm dependencies to their exact versions to ensure reproducible builds

refactor: put the duckdb.wal related to tests into a directory called /testdata to avoid confusion with production data, ensure it's not committed to git