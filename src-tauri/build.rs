fn main() {
    let mut attrs = tauri_build::Attributes::new();

    #[cfg(target_os = "windows")]
    {
        let mut windows = tauri_build::WindowsAttributes::new();
        windows = windows.app_manifest(
            r#"
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <dependency>
   <dependentAssembly>
    <assemblyIdentity
     type="win32"
     name="Microsoft.Windows.Common-Controls"
     version="6.0.0.0"
     processorArchitecture="*"
     publicKeyToken="6595b64144ccf1df"
     language="*"
    />
   </dependentAssembly>
  </dependency>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
   <security>
     <requestedPrivileges>
       <requestedExecutionLevel level="requireAdministrator" uiAccess="false" />
     </requestedPrivileges>
   </security>
  </trustInfo>
</assembly>
"#,
        );
        attrs = attrs.windows_attributes(windows);
    }

    tauri_build::try_build(attrs).expect("failed to run build script");
}
