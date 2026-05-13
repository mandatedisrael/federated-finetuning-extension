"use client";

/**
 * Drawer = Sheet from the right with the "advanced details" framing.
 * Same primitive, opinionated wrapper for the FFE Advanced Drawer
 * (TEE attestation, code hash, sealed-key info, etc.).
 */
export {
  Sheet as Drawer,
  SheetTrigger as DrawerTrigger,
  SheetClose as DrawerClose,
  SheetContent as DrawerContent,
  SheetHeader as DrawerHeader,
  SheetTitle as DrawerTitle,
  SheetDescription as DrawerDescription,
  SheetBody as DrawerBody,
  SheetFooter as DrawerFooter,
} from "./Sheet";
