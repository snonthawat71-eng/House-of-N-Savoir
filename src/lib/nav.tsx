import { createContext, useContext, useEffect } from "react";

/** ให้หน้าย่อยลงทะเบียน "ปุ่มย้อนกลับ" ของตัวเองกับ Header ส่วนกลาง
 *  เพื่อไม่ให้มีปุ่มย้อนกลับซ้ำกันในแต่ละหน้า */
export const NavCtx = createContext<{ registerBack: (fn: (() => void) | null) => void }>({
  registerBack: () => {},
});

export function useNav() {
  return useContext(NavCtx);
}

/** เรียกในหน้าจอ: ถ้ามีมุมมองย่อยเปิดอยู่ ให้ปุ่มย้อนกลับส่วนกลางปิดมุมมองนั้นก่อน */
export function useBackHandler(active: boolean, handler: () => void) {
  const { registerBack } = useNav();
  useEffect(() => {
    registerBack(active ? handler : null);
    return () => registerBack(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
