import type { Driver, DriverDocument, DriverDocumentType } from "../../types";

import { DRIVER_DOCUMENT_TYPES } from "../../types/driver";

export const REQUIRED_DRIVER_DOCUMENTS = DRIVER_DOCUMENT_TYPES;

export function hasAllRequiredDocuments(driver: Driver): boolean {
  return REQUIRED_DRIVER_DOCUMENTS.every((documentType) => {
    const document = driver.documents?.[documentType];

    return Boolean(document?.url && document?.fileName);
  });
}

export function getDriverDocuments(
  driver: Driver,
): Array<[DriverDocumentType, DriverDocument | undefined]> {
  return REQUIRED_DRIVER_DOCUMENTS.map((documentType) => [
    documentType,
    driver.documents?.[documentType],
  ]);
}
