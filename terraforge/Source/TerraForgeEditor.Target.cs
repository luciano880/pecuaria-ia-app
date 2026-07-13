using UnrealBuildTool;
using System.Collections.Generic;

public class TerraForgeEditorTarget : TargetRules
{
	public TerraForgeEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V5;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_4;
		ExtraModuleNames.Add("TerraForge");
	}
}
