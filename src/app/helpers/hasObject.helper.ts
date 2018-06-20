export function hasObject(object: any, array: any[]) {
  if (object.uuid) {
    return Boolean(
      array.filter((obj) => {
        if (obj.uuid === object.uuid) {
          return true;
        } else {
          return false;
        }
      }).length,
    );
  } else if (object.id) {
    return Boolean(
      array.filter((obj) => {
        if (obj.id === object.id) {
          return true;
        } else {
          return false;
        }
      }).length,
    );
  }
}
