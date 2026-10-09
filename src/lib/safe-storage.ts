export type StorageFailureListener = (message: string, error: unknown) => void;

const listeners = new Set<StorageFailureListener>();

/** 저장 실패를 화면에 알릴 리스너를 등록한다. 반환값으로 등록을 해제한다. */
export function onStorageFailure(listener: StorageFailureListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Storage.setItem을 예외 없이 호출한다. 용량 초과(QuotaExceededError)나
 * Safari 사생활 보호 모드처럼 저장소를 쓸 수 없는 경우 리스너에 알리고 false를 돌려준다.
 */
export function safeSetItem(storage: Storage, key: string, value: string, label: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    reportStorageFailure(storageFailureMessage(label, error), error);
    return false;
  }
}

export function isQuotaExceededError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const { name, code } = error as { name?: unknown; code?: unknown };
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  );
}

function storageFailureMessage(label: string, error: unknown): string {
  return isQuotaExceededError(error)
    ? `브라우저 저장 공간이 부족해 ${label}을(를) 저장하지 못했습니다.`
    : `브라우저 저장소를 사용할 수 없어 ${label}을(를) 저장하지 못했습니다. 사생활 보호 모드인지 확인해 주세요.`;
}

function reportStorageFailure(message: string, error: unknown): void {
  if (listeners.size === 0) {
    console.warn(message, error);
    return;
  }

  listeners.forEach((listener) => listener(message, error));
}
