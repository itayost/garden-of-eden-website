import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SURVEY_LIMITS } from "../../lib/types";

interface SurveyDetailsFieldsProps {
  /** Keeps the field ids apart when two editors are ever on one page. */
  idPrefix: string;
  title: string;
  intro: string;
  onTitleChange: (next: string) => void;
  onIntroChange: (next: string) => void;
}

/** The title and the optional intro: the parts of a Survey that stay editable after the first Response. */
export function SurveyDetailsFields({
  idPrefix,
  title,
  intro,
  onTitleChange,
  onIntroChange,
}: SurveyDetailsFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-title`}>כותרת</Label>
        <Input
          id={`${idPrefix}-title`}
          value={title}
          maxLength={SURVEY_LIMITS.titleMax}
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-intro`}>
          פתיח <span className="text-xs font-normal text-muted-foreground">לא חובה</span>
        </Label>
        <Textarea
          id={`${idPrefix}-intro`}
          value={intro}
          maxLength={SURVEY_LIMITS.introMax}
          rows={3}
          onChange={(event) => onIntroChange(event.target.value)}
        />
      </div>
    </>
  );
}
