"""
Custom forms for authentication app
"""
from django import forms
from django.contrib.auth.forms import UserCreationForm as BaseUserCreationForm
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError

User = get_user_model()


class UserCreationForm(BaseUserCreationForm):
    """
    Custom user creation form for email-based authentication.
    Django's default UserCreationForm expects 'username', but our User model
    uses 'email' as USERNAME_FIELD.
    """
    email = forms.EmailField(
        label="Email",
        max_length=254,
        help_text="Required. Enter a valid email address.",
        widget=forms.EmailInput(attrs={'autocomplete': 'email', 'class': 'vTextField'}),
        error_messages={
            'required': 'Email is required.',
            'invalid': 'Enter a valid email address.',
        }
    )
    
    class Meta:
        model = User
        fields = ("email",)
        field_classes = {"email": forms.EmailField}
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Remove username field if it exists
        if 'username' in self.fields:
            del self.fields['username']
    
    def clean_email(self):
        """Validate email uniqueness"""
        email = self.cleaned_data.get('email')
        if email:
            email = User.objects.normalize_email(email)
            if User.objects.filter(email=email).exists():
                raise ValidationError(
                    "A user with this email already exists.",
                    code='duplicate_email',
                )
        return email
    
    def save(self, commit=True):
        """Save the user with email as username"""
        user = super().save(commit=False)
        user.email = self.cleaned_data["email"]
        user.username = self.cleaned_data["email"]  # Set username to email for compatibility
        if commit:
            user.save()
        return user

