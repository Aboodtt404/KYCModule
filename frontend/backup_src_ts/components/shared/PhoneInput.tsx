import 'react-phone-number-input/style.css'
import PhoneInput from 'react-phone-number-input'
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Phone } from "lucide-react";

const schema = yup.object().shape({
  phone: yup.string().required("Phone number is required."),
});

interface Props {
    value: string;
    onChange: (value: string) => void;
}

export function PhoneInputComponent({ value, onChange }: Props) {
  const { control } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { phone: value },
  });

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Phone className="h-5 w-5 text-gray-400" />
      </div>
      <Controller
        name="phone"
        control={control}
        render={({ field }) => (
          <PhoneInput
            {...field}
            placeholder="Enter phone number"
            value={value}
            onChange={onChange}
            className="!w-full !h-14 !pl-10 !pr-4 !py-3 !text-base !border !border-gray-300 dark:!border-gray-600 !rounded-xl !bg-white dark:!bg-gray-800 !text-gray-900 dark:!text-white placeholder:!text-gray-500 dark:placeholder:!text-gray-400 focus:!outline-none focus:!ring-2 focus:!ring-emerald-500 focus:!border-emerald-500 transition-all duration-200"
            inputComponent={({ className, ...props }) => (
              <input
                {...props}
                className={`${className} !w-full !h-14 !pl-10 !pr-4 !py-3 !text-base !border !border-gray-300 dark:!border-gray-600 !rounded-xl !bg-white dark:!bg-gray-800 !text-gray-900 dark:!text-white placeholder:!text-gray-500 dark:placeholder:!text-gray-400 focus:!outline-none focus:!ring-2 focus:!ring-emerald-500 focus:!border-emerald-500 transition-all duration-200`}
              />
            )}
          />
        )}
      />
    </div>
  );
}
