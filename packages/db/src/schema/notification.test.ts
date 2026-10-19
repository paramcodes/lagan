import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { notifications } from "./notification";

describe("notification schema", () => {
  it("maps notifications to the expected snake_case columns and defaults", () => {
    const columns = getTableColumns(notifications);

    expect(Object.keys(columns)).toEqual([
      "id",
      "tenantId",
      "userId",
      "type",
      "payload",
      "readAt",
      "createdAt",
    ]);

    expect(getTableConfig(notifications).name).toBe("notifications");

    expect(columns.id.name).toBe("id");
    expect(columns.id.primary).toBe(true);
    expect(columns.id.notNull).toBe(true);

    expect(columns.tenantId.name).toBe("tenant_id");
    expect(columns.tenantId.notNull).toBe(true);

    expect(columns.userId.name).toBe("user_id");
    expect(columns.userId.notNull).toBe(true);

    expect(columns.type.name).toBe("type");
    expect(columns.type.notNull).toBe(true);

    expect(columns.payload.name).toBe("payload");
    expect(columns.payload.notNull).toBe(true);
    expect(columns.payload.hasDefault).toBe(true);
    expect(columns.payload.default).toEqual({});

    expect(columns.readAt.name).toBe("read_at");
    expect(columns.readAt.notNull).toBe(false);

    expect(columns.createdAt.name).toBe("created_at");
    expect(columns.createdAt.notNull).toBe(true);
    expect(columns.createdAt.hasDefault).toBe(true);
  });

  it("points foreign keys at user with cascading deletes", () => {
    const foreignKeys = getTableConfig(notifications).foreignKeys;

    const userFk = foreignKeys.find(
      (fk) => getTableConfig(fk.reference().foreignTable).name === "user",
    );
    if (!userFk) throw new Error("notifications.user_id foreign key missing");
    expect(userFk.reference().columns.map((column) => column.name)).toEqual(["user_id"]);
    expect(userFk.onDelete).toBe("cascade");
  });

  it("defines the expected composite and tenant indexes", () => {
    const indexes = getTableConfig(notifications).indexes.map((index) => {
      const columns = index.config.columns.map((column) =>
        column && typeof column === "object" && "name" in column && typeof column.name === "string"
          ? column.name
          : "",
      );
      return {
        name: index.config.name,
        unique: index.config.unique,
        columns,
      };
    });

    const compositeIndex = indexes.find(
      (idx) => idx.name === "notifications_user_id_read_at_created_at_idx",
    );
    if (!compositeIndex)
      throw new Error("notifications (user_id, read_at, created_at) index missing");
    expect(compositeIndex.unique).toBe(false);
    expect(compositeIndex.columns).toEqual(["user_id", "read_at", "created_at"]);

    const tenantIdx = indexes.find((idx) => idx.name === "notifications_tenant_id_idx");
    if (!tenantIdx) throw new Error("notifications tenant_id index missing");
    expect(tenantIdx.unique).toBe(false);
    expect(tenantIdx.columns).toEqual(["tenant_id"]);
  });
});
